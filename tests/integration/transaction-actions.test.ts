import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
} from "@/server/actions/transactions";
import { getTransaction } from "@/server/data/transactions";
import { DEV_USER_ID, OTHER_USER_ID, createTestCategory, resetTestData } from "../setup";

// Same seam-mocking approach as tests/integration/transactions.test.ts —
// see that file's comment for why.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

// revalidatePath depends on Next's request-scoped internals, which don't
// exist when calling a Server Action directly under Vitest.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const NONEXISTENT_ID = "clh3ans2z0000356ub9pu9q0m";

describe("transaction Server Actions", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createTransactionAction", () => {
    it("creates a transaction from valid form data", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const result = await createTransactionAction(
        null,
        formData({
          type: "EXPENSE",
          amount: "45.99",
          date: "2026-03-10",
          description: "Weekly shop",
          categoryId: category.id,
        }),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.amountCents).toBe(4599);
        expect(result.data.userId).toBe(DEV_USER_ID);
      }
    });

    it("returns a field-level error for an invalid amount string", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const result = await createTransactionAction(
        null,
        formData({
          type: "EXPENSE",
          amount: "not-a-number",
          date: "2026-03-10",
          description: "Weekly shop",
          categoryId: category.id,
        }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.amount).toBeDefined();
      }
    });

    it("returns a field-level error for a missing description", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const result = await createTransactionAction(
        null,
        formData({
          type: "EXPENSE",
          amount: "10.00",
          date: "2026-03-10",
          description: "",
          categoryId: category.id,
        }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.description).toBeDefined();
      }
    });

    it("rejects a category belonging to another user", async () => {
      const otherCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Not yours");
      const result = await createTransactionAction(
        null,
        formData({
          type: "EXPENSE",
          amount: "10.00",
          date: "2026-03-10",
          description: "Cross-link attempt",
          categoryId: otherCategory.id,
        }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/couldn't be found/i);
      }
    });

    it("ignores a client-supplied userId field entirely", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const result = await createTransactionAction(
        null,
        formData({
          type: "EXPENSE",
          amount: "10.00",
          date: "2026-03-10",
          description: "Attempted spoof",
          categoryId: category.id,
          userId: OTHER_USER_ID,
        }),
      );

      // The extra field is simply never read -- extractTransactionFields()
      // only pulls the known fields off FormData, so this proves there's no
      // path for it to influence anything, not just that validation caught it.
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.userId).toBe(DEV_USER_ID);
      }
    });
  });

  describe("updateTransactionAction", () => {
    it("updates a transaction the caller owns", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      const created = await createTransactionAction(
        null,
        formData({ type: "EXPENSE", amount: "20.00", date: "2026-03-01", description: "Lunch", categoryId: category.id }),
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const updated = await updateTransactionAction(
        created.data.id,
        null,
        formData({
          type: "EXPENSE",
          amount: "25.00",
          date: "2026-03-01",
          description: "Lunch (corrected)",
          categoryId: category.id,
        }),
      );

      expect(updated.ok).toBe(true);
      if (updated.ok) {
        expect(updated.data.amountCents).toBe(2500);
        expect(updated.data.description).toBe("Lunch (corrected)");
      }
    });

    it("returns a field error for an invalid amount on update", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      const created = await createTransactionAction(
        null,
        formData({ type: "EXPENSE", amount: "20.00", date: "2026-03-01", description: "Lunch", categoryId: category.id }),
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const updated = await updateTransactionAction(
        created.data.id,
        null,
        formData({ type: "EXPENSE", amount: "-5", date: "2026-03-01", description: "Lunch", categoryId: category.id }),
      );

      expect(updated.ok).toBe(false);
      if (!updated.ok) {
        expect(updated.fieldErrors?.amount).toBeDefined();
      }
    });

    it("cannot update another user's transaction, and the row is unmodified", async () => {
      const otherCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Other");
      actAs(OTHER_USER_ID);
      const created = await createTransactionAction(
        null,
        formData({
          type: "EXPENSE",
          amount: "20.00",
          date: "2026-03-01",
          description: "Untouched",
          categoryId: otherCategory.id,
        }),
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      actAs(DEV_USER_ID);
      const result = await updateTransactionAction(
        created.data.id,
        null,
        formData({
          type: "EXPENSE",
          amount: "999.00",
          date: "2026-03-01",
          description: "Hacked",
          categoryId: otherCategory.id,
        }),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/couldn't be found/i);
      }

      actAs(OTHER_USER_ID);
      const stillThere = await getTransaction(created.data.id);
      expect(stillThere?.description).toBe("Untouched");
      expect(stillThere?.amountCents).toBe(2000);
    });
  });

  describe("deleteTransactionAction", () => {
    it("deletes a transaction the caller owns", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      const created = await createTransactionAction(
        null,
        formData({ type: "EXPENSE", amount: "5.00", date: "2026-03-01", description: "To delete", categoryId: category.id }),
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const result = await deleteTransactionAction(created.data.id, null);
      expect(result.ok).toBe(true);
      expect(await getTransaction(created.data.id)).toBeNull();
    });

    it("cannot delete another user's transaction", async () => {
      const otherCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Other");
      actAs(OTHER_USER_ID);
      const created = await createTransactionAction(
        null,
        formData({
          type: "EXPENSE",
          amount: "5.00",
          date: "2026-03-01",
          description: "Protected",
          categoryId: otherCategory.id,
        }),
      );
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      actAs(DEV_USER_ID);
      const result = await deleteTransactionAction(created.data.id, null);
      expect(result.ok).toBe(false);

      actAs(OTHER_USER_ID);
      expect(await getTransaction(created.data.id)).not.toBeNull();
    });

    it("returns an error deleting a nonexistent transaction", async () => {
      const result = await deleteTransactionAction(NONEXISTENT_ID, null);
      expect(result.ok).toBe(false);
    });
  });
});
