import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { createTransaction } from "@/server/data/transactions";
import {
  createBudget,
  updateBudget,
  deleteBudget,
  listBudgetsWithProgress,
  getCurrentMonthBudgetStatus,
  copyBudgetsFromMonth,
} from "@/server/data/budgets";
import { archiveCategory } from "@/server/data/categories";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { currentMonthKey } from "@/lib/dates";
import { DEV_USER_ID, OTHER_USER_ID, createTestCategory, resetTestData } from "../setup";

// Same mocking approach as tests/integration/transactions.test.ts.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

// Budgets are month-relative, so every date used here is computed from
// `new Date()` at test-run time rather than a hardcoded calendar date --
// otherwise these would silently rot the next time they run in a
// different month. (The pure month-boundary math itself is exhaustively
// covered, with an injected fixed `now`, in tests/unit/dates.test.ts.)
const thisMonth = currentMonthKey();
const lastMonth = currentMonthKey(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15)));
const thisMonthDay = (day: string) => `${thisMonth}-${day}`;

const NONEXISTENT_ID = "clh3ans2z0000356ub9pu9q0m";

describe("budgets DAL", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createBudget", () => {
    it("creates a budget for an expense category", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const budget = await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 30000 });
      expect(budget.categoryId).toBe(cat.id);
      expect(budget.categoryName).toBe("Groceries");
      expect(budget.month).toBe(thisMonth);
      expect(budget.amountCents).toBe(30000);
    });

    it("rejects an income category", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await expect(
        createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 1000 }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects an archived category", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Old category");
      await prisma.category.update({ where: { id: cat.id }, data: { isArchived: true } });
      await expect(
        createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 1000 }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects a nonexistent category", async () => {
      await expect(
        createBudget({ categoryId: NONEXISTENT_ID, month: thisMonth, amountCents: 1000 }),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects a category belonging to another user", async () => {
      const otherCat = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Not yours");
      await expect(
        createBudget({ categoryId: otherCat.id, month: thisMonth, amountCents: 1000 }),
      ).rejects.toThrow(NotFoundError);
    });

    it("prevents a duplicate budget for the same category and month", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 30000 });
      await expect(
        createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 40000 }),
      ).rejects.toThrow(ValidationError);
    });

    it("allows the same category to have separate budgets in different months", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 30000 });
      const secondBudget = await createBudget({ categoryId: cat.id, month: lastMonth, amountCents: 25000 });
      expect(secondBudget.month).toBe(lastMonth);
    });

    it("rejects a negative amount", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await expect(
        createBudget({ categoryId: cat.id, month: thisMonth, amountCents: -100 }),
      ).rejects.toThrow();
    });

    it("rejects a malformed month", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await expect(
        createBudget({ categoryId: cat.id, month: "2026/03", amountCents: 1000 }),
      ).rejects.toThrow();
    });

    it("rejects an unknown extra field (mass-assignment guard)", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await expect(
        createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 1000, userId: "someone-else" }),
      ).rejects.toThrow();
    });
  });

  describe("updateBudget / deleteBudget", () => {
    it("updates the amount and notes", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const budget = await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 30000 });
      const updated = await updateBudget(budget.id, { amountCents: 35000, notes: "Bumped for holidays" });
      expect(updated.amountCents).toBe(35000);
      expect(updated.notes).toBe("Bumped for holidays");
      expect(updated.categoryId).toBe(cat.id); // untouched
    });

    it("throws NotFoundError updating a nonexistent budget", async () => {
      await expect(updateBudget(NONEXISTENT_ID, { amountCents: 100 })).rejects.toThrow(NotFoundError);
    });

    it("cannot update another user's budget, and the row is unmodified", async () => {
      const otherCat = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      actAs(OTHER_USER_ID);
      const otherBudget = await createBudget({ categoryId: otherCat.id, month: thisMonth, amountCents: 10000 });

      actAs(DEV_USER_ID);
      await expect(updateBudget(otherBudget.id, { amountCents: 999 })).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.budget.findUnique({ where: { id: otherBudget.id } });
      expect(stillThere?.amountCents).toBe(10000);
    });

    it("deletes a budget", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const budget = await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 30000 });
      await deleteBudget(budget.id);
      expect(await prisma.budget.findUnique({ where: { id: budget.id } })).toBeNull();
    });

    it("throws NotFoundError deleting a nonexistent budget", async () => {
      await expect(deleteBudget(NONEXISTENT_ID)).rejects.toThrow(NotFoundError);
    });

    it("cannot delete another user's budget", async () => {
      const otherCat = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      actAs(OTHER_USER_ID);
      const otherBudget = await createBudget({ categoryId: otherCat.id, month: thisMonth, amountCents: 10000 });

      actAs(DEV_USER_ID);
      await expect(deleteBudget(otherBudget.id)).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      expect(await prisma.budget.findUnique({ where: { id: otherBudget.id } })).not.toBeNull();
    });
  });

  describe("listBudgetsWithProgress", () => {
    it("returns an empty list when there are no budgets this month", async () => {
      expect(await listBudgetsWithProgress({ month: thisMonth })).toEqual([]);
    });

    it("derives spending from transactions rather than a stored total", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 10000 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 3000,
        date: thisMonthDay("05"),
        description: "Shop 1",
        categoryId: cat.id,
      });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 2000,
        date: thisMonthDay("10"),
        description: "Shop 2",
        categoryId: cat.id,
      });

      const [progress] = await listBudgetsWithProgress({ month: thisMonth });
      expect(progress.spentCents).toBe(5000);
      expect(progress.remainingCents).toBe(5000);
      expect(progress.percentUsed).toBe(50);
      expect(progress.isOverBudget).toBe(false);
    });

    it("excludes spending from outside the budget's month", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 10000 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 99999,
        date: `${lastMonth}-10`,
        description: "Last month's shop",
        categoryId: cat.id,
      });

      const [progress] = await listBudgetsWithProgress({ month: thisMonth });
      expect(progress.spentCents).toBe(0);
    });

    it("excludes income transactions from spending", async () => {
      const expenseCat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const incomeCat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await createBudget({ categoryId: expenseCat.id, month: thisMonth, amountCents: 10000 });
      await createTransaction({
        type: "INCOME",
        amountCents: 999999,
        date: thisMonthDay("05"),
        description: "Paycheck",
        categoryId: incomeCat.id,
      });

      const [progress] = await listBudgetsWithProgress({ month: thisMonth });
      expect(progress.spentCents).toBe(0);
    });

    it("computes an over-budget state correctly, including a percent above 100", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 10000 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 14000,
        date: thisMonthDay("05"),
        description: "Big shop",
        categoryId: cat.id,
      });

      const [progress] = await listBudgetsWithProgress({ month: thisMonth });
      expect(progress.spentCents).toBe(14000);
      expect(progress.remainingCents).toBe(-4000);
      expect(progress.percentUsed).toBe(140);
      expect(progress.isOverBudget).toBe(true);
    });

    it("guards a zero-amount budget against divide-by-zero", async () => {
      const catZeroSpend = await createTestCategory(DEV_USER_ID, "EXPENSE", "Unused");
      await createBudget({ categoryId: catZeroSpend.id, month: thisMonth, amountCents: 0 });

      const catWithSpend = await createTestCategory(DEV_USER_ID, "EXPENSE", "Overspent");
      await createBudget({ categoryId: catWithSpend.id, month: thisMonth, amountCents: 0 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 500,
        date: thisMonthDay("05"),
        description: "Unexpected spend",
        categoryId: catWithSpend.id,
      });

      const results = await listBudgetsWithProgress({ month: thisMonth });
      const zeroSpend = results.find((r) => r.categoryId === catZeroSpend.id)!;
      const withSpend = results.find((r) => r.categoryId === catWithSpend.id)!;

      expect(zeroSpend.percentUsed).toBe(0);
      expect(zeroSpend.isOverBudget).toBe(false);
      expect(Number.isFinite(withSpend.percentUsed)).toBe(true);
      expect(withSpend.percentUsed).toBe(100); // capped for display, not NaN/Infinity
      expect(withSpend.isOverBudget).toBe(true); // the raw comparison still flags it correctly
    });

    it("still resolves the category name for a budget whose category has since been archived", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Soon Archived");
      await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 5000 });
      await prisma.category.update({ where: { id: cat.id }, data: { isArchived: true } });

      const [progress] = await listBudgetsWithProgress({ month: thisMonth });
      expect(progress.categoryName).toBe("Soon Archived");
    });

    it("sorts by percent used descending, surfacing the most at-risk budget first", async () => {
      const low = await createTestCategory(DEV_USER_ID, "EXPENSE", "Low usage");
      await createBudget({ categoryId: low.id, month: thisMonth, amountCents: 10000 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 1000,
        date: thisMonthDay("05"),
        description: "Small",
        categoryId: low.id,
      });

      const high = await createTestCategory(DEV_USER_ID, "EXPENSE", "High usage");
      await createBudget({ categoryId: high.id, month: thisMonth, amountCents: 10000 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 9000,
        date: thisMonthDay("05"),
        description: "Big",
        categoryId: high.id,
      });

      const results = await listBudgetsWithProgress({ month: thisMonth });
      expect(results[0].categoryName).toBe("High usage");
      expect(results[1].categoryName).toBe("Low usage");
    });

    it("never includes another user's budgets or spending", async () => {
      const otherCat = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      actAs(OTHER_USER_ID);
      await createBudget({ categoryId: otherCat.id, month: thisMonth, amountCents: 20000 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 5000,
        date: thisMonthDay("05"),
        description: "Their spend",
        categoryId: otherCat.id,
      });

      actAs(DEV_USER_ID);
      expect(await listBudgetsWithProgress({ month: thisMonth })).toEqual([]);
    });
  });

  describe("getCurrentMonthBudgetStatus", () => {
    it("summarizes zero budgets", async () => {
      const status = await getCurrentMonthBudgetStatus();
      expect(status).toEqual({
        budgetCount: 0,
        totalBudgetedCents: 0,
        totalSpentCents: 0,
        overBudgetCount: 0,
      });
    });

    it("summarizes multiple budgets, counting how many are over", async () => {
      const overCat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Over");
      await createBudget({ categoryId: overCat.id, month: thisMonth, amountCents: 5000 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 8000,
        date: thisMonthDay("05"),
        description: "Overspent",
        categoryId: overCat.id,
      });

      const underCat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Under");
      await createBudget({ categoryId: underCat.id, month: thisMonth, amountCents: 5000 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 1000,
        date: thisMonthDay("05"),
        description: "Under budget",
        categoryId: underCat.id,
      });

      const status = await getCurrentMonthBudgetStatus();
      expect(status.budgetCount).toBe(2);
      expect(status.totalBudgetedCents).toBe(10000);
      expect(status.totalSpentCents).toBe(9000);
      expect(status.overBudgetCount).toBe(1);
    });
  });

  describe("copyBudgetsFromMonth", () => {
    it("copies each of last month's budgets into this month with the same amount", async () => {
      const cat1 = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const cat2 = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      await createBudget({ categoryId: cat1.id, month: lastMonth, amountCents: 30000, notes: "carried" });
      await createBudget({ categoryId: cat2.id, month: lastMonth, amountCents: 12000 });

      const result = await copyBudgetsFromMonth({ fromMonth: lastMonth, toMonth: thisMonth });
      expect(result).toEqual({ copiedCount: 2, skippedCount: 0 });

      const thisMonthBudgets = await listBudgetsWithProgress({ month: thisMonth });
      expect(thisMonthBudgets).toHaveLength(2);
      expect(thisMonthBudgets.find((b) => b.categoryId === cat1.id)).toMatchObject({
        amountCents: 30000,
        notes: "carried",
      });
      expect(thisMonthBudgets.find((b) => b.categoryId === cat2.id)).toMatchObject({ amountCents: 12000 });
    });

    it("skips (not throws) a category already budgeted this month", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createBudget({ categoryId: cat.id, month: lastMonth, amountCents: 30000 });
      await createBudget({ categoryId: cat.id, month: thisMonth, amountCents: 99999 });

      const result = await copyBudgetsFromMonth({ fromMonth: lastMonth, toMonth: thisMonth });
      expect(result).toEqual({ copiedCount: 0, skippedCount: 1 });

      // The existing this-month budget is untouched, not overwritten.
      const thisMonthBudgets = await listBudgetsWithProgress({ month: thisMonth });
      expect(thisMonthBudgets).toHaveLength(1);
      expect(thisMonthBudgets[0].amountCents).toBe(99999);
    });

    it("skips (not throws) a category archived since last month", async () => {
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Old Gym");
      await createBudget({ categoryId: cat.id, month: lastMonth, amountCents: 5000 });
      await archiveCategory(cat.id);

      const result = await copyBudgetsFromMonth({ fromMonth: lastMonth, toMonth: thisMonth });
      expect(result).toEqual({ copiedCount: 0, skippedCount: 1 });
    });

    it("returns zero counts when last month had no budgets", async () => {
      const result = await copyBudgetsFromMonth({ fromMonth: lastMonth, toMonth: thisMonth });
      expect(result).toEqual({ copiedCount: 0, skippedCount: 0 });
    });

    it("never copies another user's budgets", async () => {
      const otherCat = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Other's Rent");
      actAs(OTHER_USER_ID);
      await createBudget({ categoryId: otherCat.id, month: lastMonth, amountCents: 150000 });

      actAs(DEV_USER_ID);
      const result = await copyBudgetsFromMonth({ fromMonth: lastMonth, toMonth: thisMonth });
      expect(result).toEqual({ copiedCount: 0, skippedCount: 0 });
    });
  });
});
