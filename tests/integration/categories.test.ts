import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { createTransaction } from "@/server/data/transactions";
import {
  createCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
  listCategories,
  listCategoriesForManagement,
  seedDefaultCategories,
} from "@/server/data/categories";
import { DEFAULT_CATEGORIES } from "@/lib/defaultCategories";
import {
  updateCategoryAction,
  archiveCategoryAction,
  unarchiveCategoryAction,
} from "@/server/actions/categories";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { DEV_USER_ID, OTHER_USER_ID, createTestCategory, resetTestData } from "../setup";

// Same mocking approach as tests/integration/budgets.test.ts.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

// revalidatePath depends on Next's request-scoped internals, which don't
// exist when calling a Server Action directly under Vitest -- same as
// tests/integration/transaction-actions.test.ts.
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

describe("categories DAL", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createCategory", () => {
    it("creates a category with the default color", async () => {
      const category = await createCategory({ name: "Groceries", type: "EXPENSE" });
      expect(category.name).toBe("Groceries");
      expect(category.type).toBe("EXPENSE");
      expect(category.color).toBe("#64748b");
    });

    it("creates a category with an explicit color", async () => {
      const category = await createCategory({ name: "Salary", type: "INCOME", color: "#22c55e" });
      expect(category.color).toBe("#22c55e");
    });

    it("prevents a duplicate name for the same type", async () => {
      await createCategory({ name: "Groceries", type: "EXPENSE" });
      await expect(createCategory({ name: "Groceries", type: "EXPENSE" })).rejects.toThrow(ValidationError);
    });

    it("allows the same name across different types", async () => {
      await createCategory({ name: "Other", type: "EXPENSE" });
      const income = await createCategory({ name: "Other", type: "INCOME" });
      expect(income.type).toBe("INCOME");
    });

    it("scopes the duplicate-name check to the current user", async () => {
      await createTestCategory(OTHER_USER_ID, "EXPENSE", "Groceries");
      const created = await createCategory({ name: "Groceries", type: "EXPENSE" });
      expect(created.name).toBe("Groceries");
    });

    it("rejects an unknown extra field (mass-assignment guard)", async () => {
      await expect(
        createCategory({ name: "Groceries", type: "EXPENSE", userId: "someone-else" }),
      ).rejects.toThrow();
    });
  });

  describe("seedDefaultCategories", () => {
    it("gives a brand-new user the full default set", async () => {
      await seedDefaultCategories(DEV_USER_ID);
      const rows = await prisma.category.findMany({ where: { userId: DEV_USER_ID } });
      expect(rows).toHaveLength(DEFAULT_CATEGORIES.length);
      const names = rows.map((r) => r.name).sort();
      expect(names).toEqual([...DEFAULT_CATEGORIES.map((c) => c.name)].sort());
      expect(rows.every((r) => r.isSystem)).toBe(true);
    });

    it("is only created once -- calling it again does not duplicate", async () => {
      await seedDefaultCategories(DEV_USER_ID);
      await seedDefaultCategories(DEV_USER_ID);
      const count = await prisma.category.count({ where: { userId: DEV_USER_ID } });
      expect(count).toBe(DEFAULT_CATEGORIES.length);
    });

    it("gives two users separate category records, not shared/global ones", async () => {
      await seedDefaultCategories(DEV_USER_ID);
      await seedDefaultCategories(OTHER_USER_ID);

      const mine = await prisma.category.findMany({ where: { userId: DEV_USER_ID } });
      const theirs = await prisma.category.findMany({ where: { userId: OTHER_USER_ID } });
      expect(mine).toHaveLength(DEFAULT_CATEGORIES.length);
      expect(theirs).toHaveLength(DEFAULT_CATEGORIES.length);
      // Disjoint row ids -- each user has their own rows, not a shared one.
      const mineIds = new Set(mine.map((r) => r.id));
      expect(theirs.every((r) => !mineIds.has(r.id))).toBe(true);
    });

    it("does not duplicate categories under concurrent calls (simulating repeated sign-ins racing)", async () => {
      await Promise.all([
        seedDefaultCategories(DEV_USER_ID),
        seedDefaultCategories(DEV_USER_ID),
        seedDefaultCategories(DEV_USER_ID),
      ]);
      const count = await prisma.category.count({ where: { userId: DEV_USER_ID } });
      expect(count).toBe(DEFAULT_CATEGORIES.length);
    });

    it("preserves an existing custom category that collides with a default name, while still adding the other defaults", async () => {
      const custom = await createCategory({ name: "Housing", type: "EXPENSE", color: "#123456" });

      await seedDefaultCategories(DEV_USER_ID);

      // Exactly one "Housing"/EXPENSE row -- the user's own, untouched.
      const housing = await prisma.category.findMany({
        where: { userId: DEV_USER_ID, type: "EXPENSE", name: "Housing" },
      });
      expect(housing).toHaveLength(1);
      expect(housing[0]?.id).toBe(custom.id);
      expect(housing[0]?.color).toBe("#123456");
      expect(housing[0]?.isSystem).toBe(false);

      // Every other default was still added around it.
      const total = await prisma.category.count({ where: { userId: DEV_USER_ID } });
      expect(total).toBe(DEFAULT_CATEGORIES.length);
    });

    it("splits into the correct EXPENSE/INCOME counts for picker filtering", async () => {
      await seedDefaultCategories(DEV_USER_ID);
      const rows = await listCategories();

      const expenseCount = DEFAULT_CATEGORIES.filter((c) => c.type === "EXPENSE").length;
      const incomeCount = DEFAULT_CATEGORIES.filter((c) => c.type === "INCOME").length;

      expect(rows.filter((c) => c.type === "EXPENSE")).toHaveLength(expenseCount);
      expect(rows.filter((c) => c.type === "INCOME")).toHaveLength(incomeCount);
    });
  });

  describe("updateCategory", () => {
    it("renames a category", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const updated = await updateCategory(cat.id, { name: "Food & Groceries" });
      expect(updated.name).toBe("Food & Groceries");
      expect(updated.type).toBe("EXPENSE"); // untouched
    });

    it("recolors a category", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const updated = await updateCategory(cat.id, { color: "#f97316" });
      expect(updated.color).toBe("#f97316");
    });

    it("throws NotFoundError updating a nonexistent category", async () => {
      await expect(updateCategory(NONEXISTENT_ID, { name: "x" })).rejects.toThrow(NotFoundError);
    });

    it("cannot update another user's category, and the row is unmodified", async () => {
      const theirs = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      await expect(updateCategory(theirs.id, { name: "Renamed" })).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.category.findUnique({ where: { id: theirs.id } });
      expect(stillThere?.name).toBe("Theirs");
    });

    it("rejects renaming to a name already used by another of the user's categories of the same type", async () => {
      await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining Out");
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await expect(updateCategory(cat.id, { name: "Dining Out" })).rejects.toThrow(ValidationError);
    });
  });

  describe("archiveCategory / unarchiveCategory", () => {
    it("archives a category", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await archiveCategory(cat.id);
      const row = await prisma.category.findUnique({ where: { id: cat.id } });
      expect(row?.isArchived).toBe(true);
    });

    it("removes an archived category from listCategories (the picker feed)", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await archiveCategory(cat.id);
      const active = await listCategories();
      expect(active.find((c) => c.id === cat.id)).toBeUndefined();
    });

    it("keeps an in-use category's transactions intact after archiving", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createTransaction({
        type: "EXPENSE",
        amountCents: 1000,
        date: "2026-01-15",
        description: "Big shop",
        categoryId: cat.id,
      });
      await archiveCategory(cat.id);
      const tx = await prisma.transaction.findFirst({ where: { categoryId: cat.id } });
      expect(tx).not.toBeNull();
      expect(tx?.categoryId).toBe(cat.id);
    });

    it("unarchives a category, restoring it to listCategories", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await archiveCategory(cat.id);
      await unarchiveCategory(cat.id);
      const active = await listCategories();
      expect(active.find((c) => c.id === cat.id)).toBeDefined();
    });

    it("throws NotFoundError archiving a nonexistent category", async () => {
      await expect(archiveCategory(NONEXISTENT_ID)).rejects.toThrow(NotFoundError);
    });

    it("cannot archive another user's category", async () => {
      const theirs = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      await expect(archiveCategory(theirs.id)).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.category.findUnique({ where: { id: theirs.id } });
      expect(stillThere?.isArchived).toBe(false);
    });
  });

  describe("listCategoriesForManagement", () => {
    it("includes archived categories, unlike listCategories", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await archiveCategory(cat.id);
      const all = await listCategoriesForManagement();
      expect(all.find((c) => c.id === cat.id)?.isArchived).toBe(true);
    });

    it("reports an accurate transaction count", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createTransaction({
        type: "EXPENSE",
        amountCents: 500,
        date: "2026-01-05",
        description: "Snacks",
        categoryId: cat.id,
      });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 700,
        date: "2026-01-10",
        description: "More snacks",
        categoryId: cat.id,
      });
      const all = await listCategoriesForManagement();
      expect(all.find((c) => c.id === cat.id)?.transactionCount).toBe(2);
    });

    it("never includes another user's categories", async () => {
      await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      const mine = await listCategoriesForManagement();
      expect(mine.find((c) => c.name === "Theirs")).toBeUndefined();
    });
  });

  // Server-Action-level adversarial coverage: proves a forged id in
  // FormData sent through server/actions/categories.ts never reaches
  // another user's row, mirroring
  // tests/integration/transaction-actions.test.ts's approach one layer
  // above the DAL-level tests above.
  describe("category Server Actions", () => {
    it("cannot update another user's category via updateCategoryAction, and the row is unmodified", async () => {
      const theirs = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      const result = await updateCategoryAction(theirs.id, null, formData({ name: "Renamed" }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/couldn't be found/i);
      }

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.category.findUnique({ where: { id: theirs.id } });
      expect(stillThere?.name).toBe("Theirs");
    });

    it("cannot archive another user's category via archiveCategoryAction", async () => {
      const theirs = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      const result = await archiveCategoryAction(theirs.id, null);
      expect(result.ok).toBe(false);

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.category.findUnique({ where: { id: theirs.id } });
      expect(stillThere?.isArchived).toBe(false);
    });

    it("cannot unarchive another user's category via unarchiveCategoryAction", async () => {
      const theirs = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      await prisma.category.update({ where: { id: theirs.id }, data: { isArchived: true } });

      const result = await unarchiveCategoryAction(theirs.id, null);
      expect(result.ok).toBe(false);

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.category.findUnique({ where: { id: theirs.id } });
      expect(stillThere?.isArchived).toBe(true);
    });
  });
});
