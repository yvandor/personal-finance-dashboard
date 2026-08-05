import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "@/server/data/transactions";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { DEV_USER_ID, OTHER_USER_ID, createTestCategory, resetTestData } from "../setup";

// requireUserId() is the ONLY source of the acting user in the DAL (see
// server/context.ts) — there is no userId parameter anywhere to pass a
// second identity through. To exercise cross-user isolation we mock this
// one seam and swap which user it resolves to, exactly as the approved
// testing plan calls for; production code is never given this ability.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

// A syntactically valid cuid that was never actually created — used to
// exercise the "not found" path distinctly from "found but not yours".
const NONEXISTENT_ID = "clh3ans2z0000356ub9pu9q0m";

describe("transactions DAL", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createTransaction", () => {
    it("creates an expense transaction scoped to the current user", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const tx = await createTransaction({
        type: "EXPENSE",
        amountCents: 4599,
        date: "2026-03-10",
        description: "Weekly shop",
        categoryId: category.id,
      });
      expect(tx.userId).toBe(DEV_USER_ID);
      expect(tx.amountCents).toBe(4599);
      expect(tx.date).toBe("2026-03-10");
      expect(tx.categoryId).toBe(category.id);
    });

    it("creates an income transaction with optional notes", async () => {
      const category = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      const tx = await createTransaction({
        type: "INCOME",
        amountCents: 250000,
        date: "2026-03-01",
        description: "March paycheck",
        notes: "Biweekly",
        categoryId: category.id,
      });
      expect(tx.type).toBe("INCOME");
      expect(tx.notes).toBe("Biweekly");
    });

    it("rejects invalid input before writing anything to the database", async () => {
      const countBefore = await prisma.transaction.count();
      await expect(
        createTransaction({
          type: "EXPENSE",
          amountCents: -1,
          date: "2026-03-10",
          description: "x",
          categoryId: "not-a-real-id",
        }),
      ).rejects.toThrow();
      expect(await prisma.transaction.count()).toBe(countBefore);
    });

    it("rejects a categoryId that does not exist", async () => {
      await expect(
        createTransaction({
          type: "EXPENSE",
          amountCents: 1000,
          date: "2026-03-10",
          description: "Ghost category",
          categoryId: NONEXISTENT_ID,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects a categoryId belonging to another user", async () => {
      const otherCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Not yours");
      await expect(
        createTransaction({
          type: "EXPENSE",
          amountCents: 1000,
          date: "2026-03-10",
          description: "Cross-link attempt",
          categoryId: otherCategory.id,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects a category whose type doesn't match the transaction type", async () => {
      const incomeCategory = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await expect(
        createTransaction({
          type: "EXPENSE",
          amountCents: 1000,
          date: "2026-03-10",
          description: "Mismatched category type",
          categoryId: incomeCategory.id,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("getTransaction / updateTransaction / deleteTransaction", () => {
    it("reads back a created transaction by id", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      const created = await createTransaction({
        type: "EXPENSE",
        amountCents: 2000,
        date: "2026-03-01",
        description: "Lunch",
        categoryId: category.id,
      });
      const fetched = await getTransaction(created.id);
      expect(fetched).toEqual(created);
    });

    it("returns null for a nonexistent transaction", async () => {
      expect(await getTransaction(NONEXISTENT_ID)).toBeNull();
    });

    it("updates amount and description", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      const created = await createTransaction({
        type: "EXPENSE",
        amountCents: 2000,
        date: "2026-03-01",
        description: "Lunch",
        categoryId: category.id,
      });
      const updated = await updateTransaction(created.id, {
        amountCents: 2500,
        description: "Lunch (corrected)",
      });
      expect(updated.amountCents).toBe(2500);
      expect(updated.description).toBe("Lunch (corrected)");
      expect(updated.categoryId).toBe(category.id); // untouched fields survive
    });

    it("persists a date change across a month boundary", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      const created = await createTransaction({
        type: "EXPENSE",
        amountCents: 2000,
        date: "2026-03-31",
        description: "Late March",
        categoryId: category.id,
      });
      const updated = await updateTransaction(created.id, { date: "2026-04-01" });
      expect(updated.date).toBe("2026-04-01");

      const marchResults = await listTransactions({ dateFrom: "2026-03-01", dateTo: "2026-03-31" });
      const aprilResults = await listTransactions({ dateFrom: "2026-04-01", dateTo: "2026-04-30" });
      expect(marchResults.items.find((t) => t.id === created.id)).toBeUndefined();
      expect(aprilResults.items.find((t) => t.id === created.id)).toBeDefined();
    });

    it("rejects an update that would set an invalid amount", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      const created = await createTransaction({
        type: "EXPENSE",
        amountCents: 2000,
        date: "2026-03-01",
        description: "Lunch",
        categoryId: category.id,
      });
      await expect(updateTransaction(created.id, { amountCents: -50 })).rejects.toThrow();
    });

    it("throws NotFoundError updating a nonexistent transaction", async () => {
      await expect(
        updateTransaction(NONEXISTENT_ID, { description: "nope" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("deletes a transaction", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      const created = await createTransaction({
        type: "EXPENSE",
        amountCents: 500,
        date: "2026-03-01",
        description: "To delete",
        categoryId: category.id,
      });
      await deleteTransaction(created.id);
      expect(await getTransaction(created.id)).toBeNull();
    });

    it("throws NotFoundError deleting a nonexistent transaction", async () => {
      await expect(deleteTransaction(NONEXISTENT_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe("cross-user isolation", () => {
    it("cannot read another user's transaction by id", async () => {
      const otherCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Other");
      actAs(OTHER_USER_ID);
      const otherTx = await createTransaction({
        type: "EXPENSE",
        amountCents: 1000,
        date: "2026-03-01",
        description: "Belongs to other user",
        categoryId: otherCategory.id,
      });

      actAs(DEV_USER_ID);
      expect(await getTransaction(otherTx.id)).toBeNull();
    });

    it("cannot update another user's transaction, and the row is unmodified", async () => {
      const otherCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Other");
      actAs(OTHER_USER_ID);
      const otherTx = await createTransaction({
        type: "EXPENSE",
        amountCents: 1000,
        date: "2026-03-01",
        description: "Untouched",
        categoryId: otherCategory.id,
      });

      actAs(DEV_USER_ID);
      await expect(
        updateTransaction(otherTx.id, { description: "Hacked" }),
      ).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      const stillThere = await getTransaction(otherTx.id);
      expect(stillThere?.description).toBe("Untouched");
    });

    it("cannot delete another user's transaction", async () => {
      const otherCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Other");
      actAs(OTHER_USER_ID);
      const otherTx = await createTransaction({
        type: "EXPENSE",
        amountCents: 1000,
        date: "2026-03-01",
        description: "Protected",
        categoryId: otherCategory.id,
      });

      actAs(DEV_USER_ID);
      await expect(deleteTransaction(otherTx.id)).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      expect(await getTransaction(otherTx.id)).not.toBeNull();
    });

    it("list results never include another user's transactions", async () => {
      const myCategory = await createTestCategory(DEV_USER_ID, "EXPENSE", "Mine");
      await createTransaction({
        type: "EXPENSE",
        amountCents: 100,
        date: "2026-03-01",
        description: "Mine",
        categoryId: myCategory.id,
      });

      const otherCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      actAs(OTHER_USER_ID);
      await createTransaction({
        type: "EXPENSE",
        amountCents: 200,
        date: "2026-03-01",
        description: "Theirs",
        categoryId: otherCategory.id,
      });

      actAs(DEV_USER_ID);
      const { items, total } = await listTransactions();
      expect(total).toBe(1);
      expect(items.every((t) => t.userId === DEV_USER_ID)).toBe(true);
    });
  });

  describe("listTransactions filtering and pagination", () => {
    it("filters by type", async () => {
      const expenseCat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Expenses");
      const incomeCat = await createTestCategory(DEV_USER_ID, "INCOME", "Income");
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-01", description: "Spend", categoryId: expenseCat.id });
      await createTransaction({ type: "INCOME", amountCents: 5000, date: "2026-03-02", description: "Paycheck", categoryId: incomeCat.id });

      const { items } = await listTransactions({ type: "INCOME" });
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("INCOME");
    });

    it("filters by category", async () => {
      const catA = await createTestCategory(DEV_USER_ID, "EXPENSE", "A");
      const catB = await createTestCategory(DEV_USER_ID, "EXPENSE", "B");
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-01", description: "In A", categoryId: catA.id });
      await createTransaction({ type: "EXPENSE", amountCents: 200, date: "2026-03-02", description: "In B", categoryId: catB.id });

      const { items } = await listTransactions({ categoryId: catA.id });
      expect(items).toHaveLength(1);
      expect(items[0].description).toBe("In A");
    });

    it("filters by date range inclusively at both ends", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Cat");
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-01", description: "Start", categoryId: cat.id });
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-15", description: "Middle", categoryId: cat.id });
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-31", description: "End", categoryId: cat.id });
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-04-01", description: "Outside", categoryId: cat.id });

      const { items } = await listTransactions({ dateFrom: "2026-03-01", dateTo: "2026-03-31" });
      expect(items).toHaveLength(3);
      expect(items.some((t) => t.description === "Outside")).toBe(false);
    });

    it("returns an empty result for an inverted date range rather than erroring", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Cat");
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-15", description: "Whatever", categoryId: cat.id });

      const { items, total } = await listTransactions({ dateFrom: "2026-03-31", dateTo: "2026-03-01" });
      expect(items).toHaveLength(0);
      expect(total).toBe(0);
    });

    it("searches by description case-insensitively", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Cat");
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-01", description: "Starbucks Coffee", categoryId: cat.id });
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-02", description: "Gas station", categoryId: cat.id });

      const { items } = await listTransactions({ q: "starbucks" });
      expect(items).toHaveLength(1);
      expect(items[0].description).toBe("Starbucks Coffee");
    });

    it("treats % in a search term as a literal character, not a SQL wildcard", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Cat");
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-01", description: "50% off sale", categoryId: cat.id });
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-02", description: "Unrelated purchase", categoryId: cat.id });

      const { items } = await listTransactions({ q: "50%" });
      expect(items).toHaveLength(1);
      expect(items[0].description).toBe("50% off sale");
    });

    it("combines filters with AND", async () => {
      const expenseCat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Expenses");
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-03-01", description: "Coffee shop", categoryId: expenseCat.id });
      await createTransaction({ type: "EXPENSE", amountCents: 100, date: "2026-05-01", description: "Coffee shop", categoryId: expenseCat.id });

      const { items } = await listTransactions({ q: "coffee", dateFrom: "2026-03-01", dateTo: "2026-03-31" });
      expect(items).toHaveLength(1);
      expect(items[0].date).toBe("2026-03-01");
    });

    it("respects the take limit while reporting the true total", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Cat");
      for (let i = 1; i <= 5; i += 1) {
        await createTransaction({
          type: "EXPENSE",
          amountCents: 100 + i,
          date: `2026-03-0${i}`,
          description: `Item ${i}`,
          categoryId: cat.id,
        });
      }
      const { items, total, hasNext } = await listTransactions({ take: 2 });
      expect(items).toHaveLength(2);
      expect(total).toBe(5);
      expect(hasNext).toBe(true);
    });

    it("pages forward through results with a keyset cursor, with no overlap or gaps", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Cat");
      for (let i = 1; i <= 3; i += 1) {
        await createTransaction({
          type: "EXPENSE",
          amountCents: 100,
          date: `2026-03-0${i}`,
          description: `Item ${i}`,
          categoryId: cat.id,
        });
      }
      const page1 = await listTransactions({ take: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasNext).toBe(true);
      expect(page1.hasPrev).toBe(false);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await listTransactions({ take: 2, cursor: page1.nextCursor!, direction: "next" });
      expect(page2.items).toHaveLength(1);
      expect(page2.hasNext).toBe(false);
      expect(page2.hasPrev).toBe(true);

      const allIds = [...page1.items, ...page2.items].map((t) => t.id);
      expect(new Set(allIds).size).toBe(3); // no overlap, no gaps
    });

    it("pages backward from a cursor and returns to the original first page", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Cat");
      for (let i = 1; i <= 3; i += 1) {
        await createTransaction({
          type: "EXPENSE",
          amountCents: 100,
          date: `2026-03-0${i}`,
          description: `Item ${i}`,
          categoryId: cat.id,
        });
      }
      const page1 = await listTransactions({ take: 2 });
      const page2 = await listTransactions({ take: 2, cursor: page1.nextCursor!, direction: "next" });

      const backToPage1 = await listTransactions({
        take: 2,
        cursor: page2.prevCursor!,
        direction: "prev",
      });
      expect(backToPage1.items.map((t) => t.id)).toEqual(page1.items.map((t) => t.id));
      expect(backToPage1.hasPrev).toBe(false);
    });

    it("never skips or duplicates rows when multiple transactions share the same date", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Cat");
      // Five transactions on the SAME date -- a cursor keyed on date alone
      // (no id tiebreaker) would split these unpredictably across pages.
      for (let i = 1; i <= 5; i += 1) {
        await createTransaction({
          type: "EXPENSE",
          amountCents: 100 + i,
          date: "2026-03-15",
          description: `Same-day item ${i}`,
          categoryId: cat.id,
        });
      }

      const seen: string[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 10; page += 1) {
        const result: Awaited<ReturnType<typeof listTransactions>> = await listTransactions(
          cursor ? { take: 2, cursor, direction: "next" } : { take: 2 },
        );
        seen.push(...result.items.map((t) => t.id));
        if (!result.hasNext) break;
        cursor = result.nextCursor;
      }

      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5); // no duplicates
    });

    it("keeps filters applied across a keyset page boundary", async () => {
      const expenseCat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Expenses");
      const incomeCat = await createTestCategory(DEV_USER_ID, "INCOME", "Income");
      for (let i = 1; i <= 3; i += 1) {
        await createTransaction({
          type: "EXPENSE",
          amountCents: 100,
          date: `2026-03-0${i}`,
          description: `Expense ${i}`,
          categoryId: expenseCat.id,
        });
      }
      await createTransaction({
        type: "INCOME",
        amountCents: 5000,
        date: "2026-03-02",
        description: "Paycheck",
        categoryId: incomeCat.id,
      });

      const page1 = await listTransactions({ type: "EXPENSE", take: 2 });
      expect(page1.items.every((t) => t.type === "EXPENSE")).toBe(true);

      const page2 = await listTransactions({
        type: "EXPENSE",
        take: 2,
        cursor: page1.nextCursor!,
        direction: "next",
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.items.every((t) => t.type === "EXPENSE")).toBe(true);
    });
  });
});
