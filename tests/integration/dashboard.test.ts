import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { createTransaction } from "@/server/data/transactions";
import { getDashboardSummary, getMonthlyTrend, getCategoryBreakdown } from "@/server/data/dashboard";
import { DEV_USER_ID, OTHER_USER_ID, createTestCategory, resetTestData } from "../setup";

// Same approach as tests/integration/transactions.test.ts -- requireUserId()
// is the only source of the acting user, so isolation is exercised by
// swapping what it resolves to.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

// "current-month"/"current-year" are relative to the real wall clock, so
// every date used here is computed from `new Date()` at test-run time
// instead of a hardcoded calendar date -- otherwise these tests would pass
// today and silently rot the next time they run in a different month.
// (The date-range math itself is exhaustively covered, with an injected
// fixed `now`, in tests/unit/dates.test.ts.)
const now = new Date();
const thisMonthPrefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const thisMonthDay = (day: string) => `${thisMonthPrefix}-${day}`;

const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
const lastMonthPrefix = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;

describe("dashboard analytics DAL", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("getDashboardSummary", () => {
    it("computes income, expenses, net, and savings rate for the current month", async () => {
      const incomeCat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      const expenseCat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createTransaction({
        type: "INCOME",
        amountCents: 10000,
        date: thisMonthDay("05"),
        description: "Paycheck",
        categoryId: incomeCat.id,
      });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 4000,
        date: thisMonthDay("06"),
        description: "Groceries",
        categoryId: expenseCat.id,
      });

      const summary = await getDashboardSummary({ period: "current-month" });
      expect(summary.incomeCents).toBe(10000);
      expect(summary.expenseCents).toBe(4000);
      expect(summary.netCents).toBe(6000);
      expect(summary.savingsRatePercent).toBe(60); // 6000/10000 = 60%
    });

    it("returns null savings rate rather than dividing by zero when there is no income", async () => {
      const expenseCat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createTransaction({
        type: "EXPENSE",
        amountCents: 1500,
        date: thisMonthDay("05"),
        description: "Groceries",
        categoryId: expenseCat.id,
      });

      const summary = await getDashboardSummary({ period: "current-month" });
      expect(summary.incomeCents).toBe(0);
      expect(summary.savingsRatePercent).toBeNull();
    });

    it("returns all zeros for a period with no transactions", async () => {
      const summary = await getDashboardSummary({ period: "current-month" });
      expect(summary).toEqual({ incomeCents: 0, expenseCents: 0, netCents: 0, savingsRatePercent: null });
    });

    it("excludes transactions outside the selected period", async () => {
      const incomeCat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await createTransaction({
        type: "INCOME",
        amountCents: 99999,
        date: `${lastMonthPrefix}-10`,
        description: "Last month's paycheck",
        categoryId: incomeCat.id,
      });

      const summary = await getDashboardSummary({ period: "current-month" });
      expect(summary.incomeCents).toBe(0);
    });

    it("never includes another user's transactions", async () => {
      const otherCat = await createTestCategory(OTHER_USER_ID, "INCOME", "Salary");
      actAs(OTHER_USER_ID);
      await createTransaction({
        type: "INCOME",
        amountCents: 50000,
        date: thisMonthDay("05"),
        description: "Someone else's paycheck",
        categoryId: otherCat.id,
      });

      actAs(DEV_USER_ID);
      const summary = await getDashboardSummary({ period: "current-month" });
      expect(summary.incomeCents).toBe(0);
    });
  });

  describe("getMonthlyTrend", () => {
    it("zero-fills months with no transactions rather than omitting them", async () => {
      const incomeCat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await createTransaction({
        type: "INCOME",
        amountCents: 20000,
        date: thisMonthDay("05"),
        description: "Paycheck",
        categoryId: incomeCat.id,
      });

      const trend = await getMonthlyTrend({ period: "last-3-months" });
      expect(trend).toHaveLength(3);
      const thisMonthPoint = trend.find((p) => p.month === thisMonthPrefix);
      expect(thisMonthPoint?.incomeCents).toBe(20000);
      const zeroMonths = trend.filter((p) => p.month !== thisMonthPrefix);
      expect(zeroMonths.every((p) => p.incomeCents === 0 && p.expenseCents === 0)).toBe(true);
    });

    it("orders months ascending", async () => {
      const trend = await getMonthlyTrend({ period: "last-3-months" });
      const sorted = [...trend.map((p) => p.month)].sort();
      expect(trend.map((p) => p.month)).toEqual(sorted);
    });
  });

  describe("getCategoryBreakdown", () => {
    it("sums expenses per category, sorted descending, excluding income", async () => {
      const groceries = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const dining = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      const salary = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");

      await createTransaction({
        type: "EXPENSE",
        amountCents: 3000,
        date: thisMonthDay("05"),
        description: "Groceries 1",
        categoryId: groceries.id,
      });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 2000,
        date: thisMonthDay("06"),
        description: "Groceries 2",
        categoryId: groceries.id,
      });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 1500,
        date: thisMonthDay("07"),
        description: "Dinner",
        categoryId: dining.id,
      });
      await createTransaction({
        type: "INCOME",
        amountCents: 999999,
        date: thisMonthDay("01"),
        description: "Paycheck",
        categoryId: salary.id,
      });

      const breakdown = await getCategoryBreakdown({ period: "current-month" });
      expect(breakdown).toEqual([
        { categoryName: "Groceries", totalCents: 5000 },
        { categoryName: "Dining", totalCents: 1500 },
      ]);
    });

    it("collapses categories beyond the top N into an 'Other' bucket", async () => {
      const names = ["A", "B", "C", "D", "E", "F", "G", "H"];
      for (const [index, name] of names.entries()) {
        const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", name);
        await createTransaction({
          type: "EXPENSE",
          // Descending amounts so the last two ("G", "H") are smallest and
          // predictably land in "Other".
          amountCents: (names.length - index) * 100,
          date: thisMonthDay("05"),
          description: name,
          categoryId: cat.id,
        });
      }

      const breakdown = await getCategoryBreakdown({ period: "current-month" });
      const otherEntry = breakdown.find((b) => b.categoryName === "Other");
      expect(otherEntry).toBeDefined();
      // G (200) + H (100) collapsed into Other.
      expect(otherEntry?.totalCents).toBe(300);
      expect(breakdown).toHaveLength(7); // 6 top categories + "Other"
    });

    it("groups transactions with no category under 'Uncategorized'", async () => {
      // Category CRUD isn't built yet, so a transaction's category can
      // only become null via ON DELETE SET NULL on a deleted category --
      // simulated directly here the same way tests/setup.ts's fixtures
      // bypass app code for setup that isn't itself under test.
      const cat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Temp");
      const tx = await createTransaction({
        type: "EXPENSE",
        amountCents: 750,
        date: thisMonthDay("05"),
        description: "Orphaned",
        categoryId: cat.id,
      });
      await prisma.category.delete({ where: { id: cat.id } });

      const stillThere = await prisma.transaction.findUnique({ where: { id: tx.id } });
      expect(stillThere?.categoryId).toBeNull();

      const breakdown = await getCategoryBreakdown({ period: "current-month" });
      expect(breakdown).toEqual([{ categoryName: "Uncategorized", totalCents: 750 }]);
    });

    it("never includes another user's expenses", async () => {
      const otherCat = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      actAs(OTHER_USER_ID);
      await createTransaction({
        type: "EXPENSE",
        amountCents: 8000,
        date: thisMonthDay("05"),
        description: "Not mine",
        categoryId: otherCat.id,
      });

      actAs(DEV_USER_ID);
      const breakdown = await getCategoryBreakdown({ period: "current-month" });
      expect(breakdown).toEqual([]);
    });
  });
});
