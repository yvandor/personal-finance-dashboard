import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { createTransaction } from "@/server/data/transactions";
import { createSavingsGoal, contributeToGoal } from "@/server/data/savingsGoals";
import { createRecurringBill, markBillPaid } from "@/server/data/recurringBills";
import { NotFoundError } from "@/lib/errors";
import { DEV_USER_ID, OTHER_USER_ID, createTestCategory, createTestIncomeSource, resetTestData } from "../setup";

// Same mocking approach as tests/integration/recurring-bills.test.ts.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

const NOW = new Date("2026-03-10T12:00:00.000Z");

// Every assertion in the "database layer" block below goes through this
// rather than a bare `.rejects.toThrow()`. A plain throw would also be
// satisfied by the single-column FK, a NOT NULL violation, or a typo in the
// fixture -- none of which would prove the same-owner constraint did the
// rejecting. Pinning both the SQLSTATE and the constraint name is what makes
// these tests fail loudly if a future migration drops one of the five.
//
// Prisma surfaces the underlying Postgres error through the driver adapter:
// the outer `code` is Prisma's own (P2003 for a modelled write), while the
// real SQLSTATE and the offending constraint live in `meta`.
const FOREIGN_KEY_VIOLATION = "23503";

interface DriverAdapterFailure {
  originalCode?: string;
  constraint?: { index?: string };
}

function driverFailure(error: unknown): DriverAdapterFailure {
  const meta = (error as { meta?: { driverAdapterError?: { cause?: DriverAdapterFailure } } })?.meta;
  return meta?.driverAdapterError?.cause ?? {};
}

async function expectSameOwnerRejection(constraintName: string, write: () => Promise<unknown>): Promise<void> {
  let caught: unknown;
  try {
    await write();
  } catch (error) {
    caught = error;
  }

  expect(caught, `expected ${constraintName} to reject this write, but it succeeded`).toBeDefined();
  const failure = driverFailure(caught);
  expect(failure.originalCode).toBe(FOREIGN_KEY_VIOLATION);
  expect(failure.constraint?.index).toBe(constraintName);
}

describe("same-owner composite foreign keys", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // The DAL is the layer users actually reach, and it already refuses every
  // cross-user link below by scoping each parent lookup to the session user.
  // These restate that from one place, as the "before" half of the
  // defense-in-depth pair -- the canonical per-feature coverage still lives
  // in the feature's own suite (income-sources, savings-goals,
  // recurring-bills). If one of these ever starts passing a forged id
  // through, the database block below is what still catches it.
  describe("application layer", () => {
    it("rejects a transaction linked to another user's income source", async () => {
      const theirSource = await createTestIncomeSource(OTHER_USER_ID, "Their paycheck", 250000, 15);
      const myCategory = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");

      await expect(
        createTransaction({
          type: "INCOME",
          amountCents: 100000,
          date: "2026-03-15",
          description: "Cross-owner income link",
          categoryId: myCategory.id,
          incomeSourceId: theirSource.id,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects a contribution to another user's savings goal", async () => {
      actAs(OTHER_USER_ID);
      const theirGoal = await createSavingsGoal({ name: "Their trip", targetCents: 500000 });

      actAs(DEV_USER_ID);
      await expect(contributeToGoal(theirGoal.id, { amountCents: 1000, date: "2026-03-15" })).rejects.toThrow(
        NotFoundError,
      );
      expect(await prisma.savingsContribution.count({ where: { goalId: theirGoal.id } })).toBe(0);
    });

    it("rejects a payment against another user's recurring bill", async () => {
      actAs(OTHER_USER_ID);
      const theirBill = await createRecurringBill({ name: "Their rent", amountCents: 150000, dueDay: 1 });

      actAs(DEV_USER_ID);
      await expect(markBillPaid(theirBill.id, { periodMonth: "2026-03" }, NOW)).rejects.toThrow(NotFoundError);
      expect(await prisma.recurringBillPayment.count({ where: { billId: theirBill.id } })).toBe(0);
    });

    it("rejects a recurring bill categorised into another user's category", async () => {
      const theirCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Their utilities");

      await expect(
        createRecurringBill({ name: "Electric", amountCents: 8000, dueDay: 15, categoryId: theirCategory.id }),
      ).rejects.toThrow(NotFoundError);
    });

    // RecurringBillPayment.transactionId has no application-layer test here
    // because it has no application-layer input: markBillPaid() creates the
    // transaction itself inside the same $transaction and never accepts a
    // caller-supplied transaction id (server/data/recurringBills.ts). There
    // is nothing for a forged request to aim at today, which is precisely
    // why the database-level guarantee below is the only real coverage that
    // relation can have -- it constrains whatever code is written next.
  });

  // The half that actually matters for this task: every write below skips
  // server/data/** entirely and goes straight at Postgres with a correctly
  // shaped, fully owned-looking row whose only flaw is that the parent
  // belongs to someone else. Each one satisfies the plain single-column FK
  // (the referenced row does exist), so only the composite same-owner
  // constraint can reject it.
  describe("database layer", () => {
    it("refuses a transaction pointing at another user's income source", async () => {
      const theirSource = await createTestIncomeSource(OTHER_USER_ID, "Their paycheck", 250000, 15);

      await expectSameOwnerRejection("transactions_income_source_same_owner", () =>
        prisma.transaction.create({
          data: {
            userId: DEV_USER_ID,
            type: "INCOME",
            amountCents: 100000,
            date: new Date("2026-03-15"),
            description: "Cross-owner income link",
            incomeSourceId: theirSource.id,
          },
        }),
      );
    });

    it("refuses a contribution pointing at another user's savings goal", async () => {
      const theirGoal = await prisma.savingsGoal.create({
        data: { userId: OTHER_USER_ID, name: "Their trip", targetCents: 500000 },
      });

      await expectSameOwnerRejection("savings_contributions_goal_same_owner", () =>
        prisma.savingsContribution.create({
          data: { userId: DEV_USER_ID, goalId: theirGoal.id, amountCents: 1000, date: new Date("2026-03-15") },
        }),
      );
    });

    it("refuses a payment pointing at another user's recurring bill", async () => {
      const theirBill = await prisma.recurringBill.create({
        data: { userId: OTHER_USER_ID, name: "Their rent", amountCents: 150000, dueDay: 1 },
      });

      await expectSameOwnerRejection("recurring_bill_payments_bill_same_owner", () =>
        prisma.recurringBillPayment.create({
          data: { userId: DEV_USER_ID, billId: theirBill.id, periodMonth: "2026-03" },
        }),
      );
    });

    it("refuses a recurring bill pointing at another user's category", async () => {
      const theirCategory = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Their utilities");

      await expectSameOwnerRejection("recurring_bills_category_same_owner", () =>
        prisma.recurringBill.create({
          data: {
            userId: DEV_USER_ID,
            name: "Electric",
            amountCents: 8000,
            dueDay: 15,
            categoryId: theirCategory.id,
          },
        }),
      );
    });

    it("refuses a payment pointing at another user's transaction", async () => {
      const myBill = await prisma.recurringBill.create({
        data: { userId: DEV_USER_ID, name: "Electric", amountCents: 8000, dueDay: 15 },
      });
      const theirTransaction = await prisma.transaction.create({
        data: {
          userId: OTHER_USER_ID,
          type: "EXPENSE",
          amountCents: 8000,
          date: new Date("2026-03-15"),
          description: "Their electric bill",
        },
      });

      await expectSameOwnerRejection("recurring_bill_payments_transaction_same_owner", () =>
        prisma.recurringBillPayment.create({
          data: {
            userId: DEV_USER_ID,
            billId: myBill.id,
            periodMonth: "2026-03",
            transactionId: theirTransaction.id,
          },
        }),
      );
    });

    // An UPDATE that re-points an already-valid row at another user's parent
    // is a distinct code path from INSERT at the SQL level, and it is the
    // shape a partial `where` clause in an edit handler would actually
    // produce. Covered once here rather than five times -- the constraint
    // machinery is identical across all five.
    it("refuses re-pointing an existing transaction at another user's income source", async () => {
      const mySource = await createTestIncomeSource(DEV_USER_ID, "My paycheck", 250000, 15);
      const theirSource = await createTestIncomeSource(OTHER_USER_ID, "Their paycheck", 250000, 15);
      const mine = await prisma.transaction.create({
        data: {
          userId: DEV_USER_ID,
          type: "INCOME",
          amountCents: 100000,
          date: new Date("2026-03-15"),
          description: "March paycheck",
          incomeSourceId: mySource.id,
        },
      });

      await expectSameOwnerRejection("transactions_income_source_same_owner", () =>
        prisma.transaction.update({ where: { id: mine.id }, data: { incomeSourceId: theirSource.id } }),
      );
    });

    // The mirror image of every test above: the same writes with a
    // same-owner parent must still succeed. Without this, a constraint that
    // rejected *everything* would leave the whole block green.
    it("still allows every one of those links within a single owner", async () => {
      const myCategory = await createTestCategory(DEV_USER_ID, "EXPENSE", "Utilities");
      const mySource = await createTestIncomeSource(DEV_USER_ID, "My paycheck", 250000, 15);
      const myGoal = await prisma.savingsGoal.create({
        data: { userId: DEV_USER_ID, name: "My trip", targetCents: 500000 },
      });
      const myBill = await prisma.recurringBill.create({
        data: { userId: DEV_USER_ID, name: "Electric", amountCents: 8000, dueDay: 15, categoryId: myCategory.id },
      });
      const myTransaction = await prisma.transaction.create({
        data: {
          userId: DEV_USER_ID,
          type: "INCOME",
          amountCents: 100000,
          date: new Date("2026-03-15"),
          description: "March paycheck",
          incomeSourceId: mySource.id,
        },
      });
      const myContribution = await prisma.savingsContribution.create({
        data: { userId: DEV_USER_ID, goalId: myGoal.id, amountCents: 1000, date: new Date("2026-03-15") },
      });
      const myPayment = await prisma.recurringBillPayment.create({
        data: {
          userId: DEV_USER_ID,
          billId: myBill.id,
          periodMonth: "2026-03",
          transactionId: myTransaction.id,
        },
      });

      expect(myBill.categoryId).toBe(myCategory.id);
      expect(myTransaction.incomeSourceId).toBe(mySource.id);
      expect(myContribution.goalId).toBe(myGoal.id);
      expect(myPayment.transactionId).toBe(myTransaction.id);
    });

    // Guards the property the migration's comment turns on: the composite
    // constraints must not make a nullable link mandatory. Postgres's
    // default MATCH SIMPLE exempts a row whenever any column of the key is
    // NULL, which is what keeps "not every transaction has an income
    // source" true.
    it("still allows a null link on every nullable side", async () => {
      const noSource = await prisma.transaction.create({
        data: {
          userId: DEV_USER_ID,
          type: "EXPENSE",
          amountCents: 5000,
          date: new Date("2026-03-15"),
          description: "Uncategorised, unsourced",
        },
      });
      const noCategory = await prisma.recurringBill.create({
        data: { userId: DEV_USER_ID, name: "Electric", amountCents: 8000, dueDay: 15 },
      });
      const noTransaction = await prisma.recurringBillPayment.create({
        data: { userId: DEV_USER_ID, billId: noCategory.id, periodMonth: "2026-03" },
      });

      expect(noSource.incomeSourceId).toBeNull();
      expect(noSource.categoryId).toBeNull();
      expect(noCategory.categoryId).toBeNull();
      expect(noTransaction.transactionId).toBeNull();
    });

    // Deleting a parent must keep working: the composite's ON DELETE SET
    // NULL would null every column of the key, `userId` included, and
    // `userId` is NOT NULL. The narrower single-column FK is what runs
    // first and keeps the delete legal -- which is why the migration adds
    // these constraints alongside the plain ones rather than replacing
    // them. Rehearsed against a real database; dropping the plain FK fails
    // here with 23502.
    it("still allows deleting a parent that owns children", async () => {
      const mySource = await createTestIncomeSource(DEV_USER_ID, "My paycheck", 250000, 15);
      const myCategory = await createTestCategory(DEV_USER_ID, "EXPENSE", "Utilities");
      const myTransaction = await prisma.transaction.create({
        data: {
          userId: DEV_USER_ID,
          type: "INCOME",
          amountCents: 100000,
          date: new Date("2026-03-15"),
          description: "March paycheck",
          incomeSourceId: mySource.id,
        },
      });
      const myBill = await prisma.recurringBill.create({
        data: { userId: DEV_USER_ID, name: "Electric", amountCents: 8000, dueDay: 15, categoryId: myCategory.id },
      });

      await prisma.incomeSource.delete({ where: { id: mySource.id } });
      await prisma.category.delete({ where: { id: myCategory.id } });

      const detachedTransaction = await prisma.transaction.findUniqueOrThrow({ where: { id: myTransaction.id } });
      const detachedBill = await prisma.recurringBill.findUniqueOrThrow({ where: { id: myBill.id } });

      expect(detachedTransaction.incomeSourceId).toBeNull();
      expect(detachedTransaction.userId).toBe(DEV_USER_ID);
      expect(detachedBill.categoryId).toBeNull();
      expect(detachedBill.userId).toBe(DEV_USER_ID);
    });
  });
});
