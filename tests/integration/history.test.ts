import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { createTransaction } from "@/server/data/transactions";
import { createBudget } from "@/server/data/budgets";
import { getMonthlyHistory } from "@/server/data/history";
import { lastNMonths, currentMonthKey } from "@/lib/dates";
import { DEV_USER_ID, OTHER_USER_ID, createTestCategory, resetTestData } from "../setup";

// Same approach as tests/integration/dashboard.test.ts -- requireUserId()
// is the only source of the acting user, so isolation is exercised by
// swapping what it resolves to.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

// Every date used here is computed from `new Date()` at test-run time
// rather than a hardcoded calendar date, same reasoning as
// tests/integration/dashboard.test.ts -- "the last N months" is relative
// to the real wall clock, and getMonthlyHistory itself has no injectable
// `now` parameter (see server/data/history.ts).
const now = new Date();
const thisMonth = currentMonthKey(now);
const thisMonthDay = (day: string) => `${thisMonth}-${day}`;
const [twoMonthsAgo] = lastNMonths(3, now); // ascending, so index 0 is oldest

describe("history DAL", () => {
  beforeEach(async () => {
    await resetTestData();
    // tests/setup.ts's resetTestData() predates RecurringBill/
    // RecurringBillPayment (added for v1.3) and doesn't clean them up --
    // owning that shared file isn't in this slice's scope, so this test
    // file clears its own leftovers directly rather than relying on an
    // upstream reset it can't modify.
    await prisma.recurringBillPayment.deleteMany({ where: { userId: { in: [DEV_USER_ID, OTHER_USER_ID] } } });
    await prisma.recurringBill.deleteMany({ where: { userId: { in: [DEV_USER_ID, OTHER_USER_ID] } } });
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("getMonthlyHistory", () => {
    it("returns monthsBack rows, ascending, zero-filled when there's no data", async () => {
      const history = await getMonthlyHistory({ monthsBack: 3 });
      expect(history).toHaveLength(3);
      expect(history.map((h) => h.month)).toEqual(lastNMonths(3, now));
      expect(
        history.every(
          (h) =>
            h.incomeCents === 0 &&
            h.expenseCents === 0 &&
            h.netCents === 0 &&
            h.totalBudgetedCents === 0 &&
            h.totalSpentCents === 0 &&
            h.billsPaidCount === 0,
        ),
      ).toBe(true);
    });

    it("defaults to 6 months when monthsBack is omitted", async () => {
      const history = await getMonthlyHistory();
      expect(history).toHaveLength(6);
      expect(history.map((h) => h.month)).toEqual(lastNMonths(6, now));
    });

    it("computes income, expenses, and net for the current month from transactions", async () => {
      const incomeCat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      const expenseCat = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      await createTransaction({
        type: "INCOME",
        amountCents: 500000,
        date: thisMonthDay("05"),
        description: "Paycheck",
        categoryId: incomeCat.id,
      });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 20000,
        date: thisMonthDay("06"),
        description: "Groceries",
        categoryId: expenseCat.id,
      });

      const history = await getMonthlyHistory({ monthsBack: 3 });
      const currentRow = history.find((h) => h.month === thisMonth);
      expect(currentRow?.incomeCents).toBe(500000);
      expect(currentRow?.expenseCents).toBe(20000);
      expect(currentRow?.netCents).toBe(480000);
    });

    it("places a transaction in the month it belongs to, not adjacent months", async () => {
      const incomeCat = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await createTransaction({
        type: "INCOME",
        amountCents: 90000,
        date: `${twoMonthsAgo}-10`,
        description: "Older paycheck",
        categoryId: incomeCat.id,
      });

      const history = await getMonthlyHistory({ monthsBack: 3 });
      const oldRow = history.find((h) => h.month === twoMonthsAgo);
      const currentRow = history.find((h) => h.month === thisMonth);
      expect(oldRow?.incomeCents).toBe(90000);
      expect(currentRow?.incomeCents).toBe(0);
    });

    it("computes total budgeted and total spent for the month from budgets and matching expense transactions", async () => {
      const groceries = await createTestCategory(DEV_USER_ID, "EXPENSE", "Groceries");
      const dining = await createTestCategory(DEV_USER_ID, "EXPENSE", "Dining");
      await createBudget({ categoryId: groceries.id, month: thisMonth, amountCents: 30000 });
      await createBudget({ categoryId: dining.id, month: thisMonth, amountCents: 10000 });
      await createTransaction({
        type: "EXPENSE",
        amountCents: 12000,
        date: thisMonthDay("05"),
        description: "Groceries run",
        categoryId: groceries.id,
      });

      const history = await getMonthlyHistory({ monthsBack: 1 });
      const currentRow = history.find((h) => h.month === thisMonth);
      expect(currentRow?.totalBudgetedCents).toBe(40000); // 30000 + 10000
      expect(currentRow?.totalSpentCents).toBe(12000); // only groceries has spend
    });

    it("excludes spend in a category that has no budget that month from totalSpentCents", async () => {
      const unbudgeted = await createTestCategory(DEV_USER_ID, "EXPENSE", "Unbudgeted");
      await createTransaction({
        type: "EXPENSE",
        amountCents: 5000,
        date: thisMonthDay("05"),
        description: "Not budgeted",
        categoryId: unbudgeted.id,
      });

      const history = await getMonthlyHistory({ monthsBack: 1 });
      const currentRow = history.find((h) => h.month === thisMonth);
      expect(currentRow?.totalBudgetedCents).toBe(0);
      expect(currentRow?.totalSpentCents).toBe(0);
    });

    it("computes bills paid/total from active RecurringBill and that month's RecurringBillPayment rows", async () => {
      const bill1 = await prisma.recurringBill.create({
        data: { userId: DEV_USER_ID, name: "Rent", amountCents: 150000, dueDay: 1, isActive: true },
      });
      const bill2 = await prisma.recurringBill.create({
        data: { userId: DEV_USER_ID, name: "Internet", amountCents: 6000, dueDay: 15, isActive: true },
      });
      // An inactive bill doesn't count toward the total.
      await prisma.recurringBill.create({
        data: { userId: DEV_USER_ID, name: "Cancelled gym", amountCents: 4000, dueDay: 10, isActive: false },
      });
      await prisma.recurringBillPayment.create({
        data: { userId: DEV_USER_ID, billId: bill1.id, periodMonth: thisMonth },
      });

      const history = await getMonthlyHistory({ monthsBack: 1 });
      const currentRow = history.find((h) => h.month === thisMonth);
      expect(currentRow?.billsTotalCount).toBe(2); // bill1 + bill2, not the inactive one
      expect(currentRow?.billsPaidCount).toBe(1); // only bill1 paid this month

      void bill2;
    });

    it("does not count a payment logged for a different month", async () => {
      const bill = await prisma.recurringBill.create({
        data: { userId: DEV_USER_ID, name: "Rent", amountCents: 150000, dueDay: 1, isActive: true },
      });
      await prisma.recurringBillPayment.create({
        data: { userId: DEV_USER_ID, billId: bill.id, periodMonth: twoMonthsAgo },
      });

      const history = await getMonthlyHistory({ monthsBack: 3 });
      const currentRow = history.find((h) => h.month === thisMonth);
      const oldRow = history.find((h) => h.month === twoMonthsAgo);
      expect(currentRow?.billsPaidCount).toBe(0);
      expect(oldRow?.billsPaidCount).toBe(1);
    });

    it("never includes another user's transactions, budgets, or bills", async () => {
      const otherIncomeCat = await createTestCategory(OTHER_USER_ID, "INCOME", "Salary");
      const otherExpenseCat = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Groceries");
      actAs(OTHER_USER_ID);
      await createTransaction({
        type: "INCOME",
        amountCents: 999999,
        date: thisMonthDay("05"),
        description: "Someone else's paycheck",
        categoryId: otherIncomeCat.id,
      });
      await createBudget({ categoryId: otherExpenseCat.id, month: thisMonth, amountCents: 50000 });
      const otherBill = await prisma.recurringBill.create({
        data: { userId: OTHER_USER_ID, name: "Their rent", amountCents: 100000, dueDay: 1, isActive: true },
      });
      await prisma.recurringBillPayment.create({
        data: { userId: OTHER_USER_ID, billId: otherBill.id, periodMonth: thisMonth },
      });

      actAs(DEV_USER_ID);
      const history = await getMonthlyHistory({ monthsBack: 1 });
      const currentRow = history.find((h) => h.month === thisMonth);
      expect(currentRow?.incomeCents).toBe(0);
      expect(currentRow?.totalBudgetedCents).toBe(0);
      expect(currentRow?.billsTotalCount).toBe(0);
      expect(currentRow?.billsPaidCount).toBe(0);
    });

    it("rejects a monthsBack outside the 1-24 range", async () => {
      await expect(getMonthlyHistory({ monthsBack: 0 })).rejects.toThrow();
      await expect(getMonthlyHistory({ monthsBack: 25 })).rejects.toThrow();
    });

    it("rejects an unknown extra field (mass-assignment guard)", async () => {
      await expect(getMonthlyHistory({ monthsBack: 3, userId: "someone-else" })).rejects.toThrow();
    });
  });
});
