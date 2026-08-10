import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import {
  createRecurringBill,
  updateRecurringBill,
  archiveRecurringBill,
  unarchiveRecurringBill,
  markBillPaid,
  listRecurringBills,
} from "@/server/data/recurringBills";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { DEV_USER_ID, OTHER_USER_ID, createTestCategory, resetTestData } from "../setup";

// Same mocking approach as tests/integration/categories.test.ts.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

const NONEXISTENT_ID = "clh3ans2z0000356ub9pu9q0m";
const NOW = new Date("2026-03-10T12:00:00Z");

describe("recurring bills DAL", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createRecurringBill", () => {
    it("creates a minimal bill with no category", async () => {
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      expect(bill.name).toBe("Rent");
      expect(bill.amountCents).toBe(150000);
      expect(bill.dueDay).toBe(1);
      expect(bill.categoryId).toBeNull();
      expect(bill.categoryName).toBeNull();
      expect(bill.isActive).toBe(true);
    });

    it("creates a bill with a valid EXPENSE category", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Utilities");
      const bill = await createRecurringBill({ name: "Electric", amountCents: 8000, dueDay: 15, categoryId: category.id });
      expect(bill.categoryId).toBe(category.id);
      expect(bill.categoryName).toBe("Utilities");
    });

    it("rejects an INCOME category", async () => {
      const category = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await expect(
        createRecurringBill({ name: "Electric", amountCents: 8000, dueDay: 15, categoryId: category.id }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects an archived category", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Utilities");
      await prisma.category.update({ where: { id: category.id }, data: { isArchived: true } });
      await expect(
        createRecurringBill({ name: "Electric", amountCents: 8000, dueDay: 15, categoryId: category.id }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects another user's category", async () => {
      const theirs = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Theirs");
      await expect(
        createRecurringBill({ name: "Electric", amountCents: 8000, dueDay: 15, categoryId: theirs.id }),
      ).rejects.toThrow(NotFoundError);
    });

    it("prevents a duplicate name for the same user", async () => {
      await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      await expect(createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 })).rejects.toThrow(ValidationError);
    });

    it("scopes the duplicate-name check to the current user", async () => {
      actAs(OTHER_USER_ID);
      await createRecurringBill({ name: "Rent", amountCents: 100000, dueDay: 1 });
      actAs(DEV_USER_ID);
      const mine = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      expect(mine.name).toBe("Rent");
    });

    it("rejects an unknown extra field (mass-assignment guard)", async () => {
      await expect(
        createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1, userId: "someone-else" }),
      ).rejects.toThrow();
    });
  });

  describe("updateRecurringBill", () => {
    it("renames a bill and changes its amount/dueDay", async () => {
      const created = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      const updated = await updateRecurringBill(created.id, { name: "Apartment Rent", amountCents: 160000, dueDay: 3 });
      expect(updated.name).toBe("Apartment Rent");
      expect(updated.amountCents).toBe(160000);
      expect(updated.dueDay).toBe(3);
    });

    it("assigns a category on an existing bill", async () => {
      const created = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Housing");
      const updated = await updateRecurringBill(created.id, { categoryId: category.id });
      expect(updated.categoryId).toBe(category.id);
      expect(updated.categoryName).toBe("Housing");
    });

    it("clears an existing category with an explicit null", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Housing");
      const created = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1, categoryId: category.id });
      const updated = await updateRecurringBill(created.id, { categoryId: null });
      expect(updated.categoryId).toBeNull();
      expect(updated.categoryName).toBeNull();
    });

    it("rejects reassigning to an income category", async () => {
      const created = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      const income = await createTestCategory(DEV_USER_ID, "INCOME", "Salary");
      await expect(updateRecurringBill(created.id, { categoryId: income.id })).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError updating a nonexistent bill", async () => {
      await expect(updateRecurringBill(NONEXISTENT_ID, { name: "x" })).rejects.toThrow(NotFoundError);
    });

    it("cannot update another user's bill, and the row is unmodified", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createRecurringBill({ name: "Theirs", amountCents: 5000, dueDay: 5 });
      actAs(DEV_USER_ID);
      await expect(updateRecurringBill(theirs.id, { name: "Renamed" })).rejects.toThrow(NotFoundError);

      const stillTheirs = await prisma.recurringBill.findUnique({ where: { id: theirs.id } });
      expect(stillTheirs?.name).toBe("Theirs");
    });

    it("rejects renaming to a name already used by another of the user's bills", async () => {
      await createRecurringBill({ name: "Internet", amountCents: 6000, dueDay: 10 });
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      await expect(updateRecurringBill(bill.id, { name: "Internet" })).rejects.toThrow(ValidationError);
    });
  });

  describe("archiveRecurringBill / unarchiveRecurringBill", () => {
    it("archives a bill", async () => {
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      await archiveRecurringBill(bill.id);
      const row = await prisma.recurringBill.findUnique({ where: { id: bill.id } });
      expect(row?.isActive).toBe(false);
    });

    it("keeps an archived bill's payment history intact", async () => {
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      await markBillPaid(bill.id, { periodMonth: "2026-02" }, NOW);
      await archiveRecurringBill(bill.id);
      const payments = await prisma.recurringBillPayment.findMany({ where: { billId: bill.id } });
      expect(payments).toHaveLength(1);
    });

    it("unarchives a bill", async () => {
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      await archiveRecurringBill(bill.id);
      await unarchiveRecurringBill(bill.id);
      const row = await prisma.recurringBill.findUnique({ where: { id: bill.id } });
      expect(row?.isActive).toBe(true);
    });

    it("throws NotFoundError archiving a nonexistent bill", async () => {
      await expect(archiveRecurringBill(NONEXISTENT_ID)).rejects.toThrow(NotFoundError);
    });

    it("cannot archive another user's bill", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createRecurringBill({ name: "Theirs", amountCents: 5000, dueDay: 5 });
      actAs(DEV_USER_ID);
      await expect(archiveRecurringBill(theirs.id)).rejects.toThrow(NotFoundError);

      const stillActive = await prisma.recurringBill.findUnique({ where: { id: theirs.id } });
      expect(stillActive?.isActive).toBe(true);
    });
  });

  describe("listRecurringBills", () => {
    it("marks a bill unpaid this month by default", async () => {
      await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      const bills = await listRecurringBills(NOW);
      expect(bills.find((b) => b.name === "Rent")?.isPaidThisMonth).toBe(false);
    });

    it("marks a bill paid this month after markBillPaid for the current period", async () => {
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      await markBillPaid(bill.id, { periodMonth: "2026-03" }, NOW);
      const bills = await listRecurringBills(NOW);
      const found = bills.find((b) => b.id === bill.id);
      expect(found?.isPaidThisMonth).toBe(true);
      expect(found?.status).toBe("PAID");
    });

    it("does not consider a payment for a different month as paid this month", async () => {
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      await markBillPaid(bill.id, { periodMonth: "2026-02" }, NOW);
      const bills = await listRecurringBills(NOW);
      expect(bills.find((b) => b.id === bill.id)?.isPaidThisMonth).toBe(false);
    });

    it("clamps dueDay=31 to April's real last day (the 30th) in the returned status", async () => {
      await createRecurringBill({ name: "End of Month", amountCents: 1000, dueDay: 31 });
      const bills = await listRecurringBills(new Date("2026-04-15T00:00:00Z"));
      expect(bills.find((b) => b.name === "End of Month")?.dueDate).toBe("2026-04-30");
    });

    it("includes an archived bill, ordered after active ones", async () => {
      const active = await createRecurringBill({ name: "Active One", amountCents: 1000, dueDay: 1 });
      const toArchive = await createRecurringBill({ name: "Archived One", amountCents: 1000, dueDay: 2 });
      await archiveRecurringBill(toArchive.id);

      const bills = await listRecurringBills(NOW);
      expect(bills.map((b) => b.id)).toContain(active.id);
      expect(bills.map((b) => b.id)).toContain(toArchive.id);
      const activeIndex = bills.findIndex((b) => b.id === active.id);
      const archivedIndex = bills.findIndex((b) => b.id === toArchive.id);
      expect(activeIndex).toBeLessThan(archivedIndex);
      expect(bills.find((b) => b.id === toArchive.id)?.isActive).toBe(false);
    });

    it("never includes another user's bills", async () => {
      actAs(OTHER_USER_ID);
      await createRecurringBill({ name: "Theirs", amountCents: 5000, dueDay: 5 });
      actAs(DEV_USER_ID);
      const mine = await listRecurringBills(NOW);
      expect(mine.find((b) => b.name === "Theirs")).toBeUndefined();
    });
  });

  describe("markBillPaid", () => {
    it("records a payment without logging a transaction by default", async () => {
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      const result = await markBillPaid(bill.id, { periodMonth: "2026-03" }, NOW);

      expect(result.transactionId).toBeNull();
      expect(result.bill.isPaidThisMonth).toBe(true);

      const payment = await prisma.recurringBillPayment.findUnique({ where: { id: result.paymentId } });
      expect(payment?.transactionId).toBeNull();
      expect(payment?.periodMonth).toBe("2026-03");

      const transactionCount = await prisma.transaction.count({ where: { userId: DEV_USER_ID } });
      expect(transactionCount).toBe(0);
    });

    it("logs a linked expense transaction when logTransaction is true", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Housing");
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1, categoryId: category.id });

      const result = await markBillPaid(
        bill.id,
        { periodMonth: "2026-03", logTransaction: true, date: "2026-03-01" },
        NOW,
      );

      expect(result.transactionId).not.toBeNull();

      const transaction = await prisma.transaction.findUnique({ where: { id: result.transactionId! } });
      expect(transaction).not.toBeNull();
      expect(transaction?.type).toBe("EXPENSE");
      expect(transaction?.amountCents).toBe(150000);
      expect(transaction?.categoryId).toBe(category.id);
      expect(transaction?.description).toBe("Rent");

      const payment = await prisma.recurringBillPayment.findUnique({ where: { id: result.paymentId } });
      expect(payment?.transactionId).toBe(result.transactionId);
    });

    it("rejects logging a transaction for a bill with no category", async () => {
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      await expect(
        markBillPaid(bill.id, { periodMonth: "2026-03", logTransaction: true }, NOW),
      ).rejects.toThrow(ValidationError);

      // No partial write: no payment, no transaction.
      const payments = await prisma.recurringBillPayment.count({ where: { billId: bill.id } });
      const transactions = await prisma.transaction.count({ where: { userId: DEV_USER_ID } });
      expect(payments).toBe(0);
      expect(transactions).toBe(0);
    });

    it("rejects marking the same bill paid twice for the same period", async () => {
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1 });
      await markBillPaid(bill.id, { periodMonth: "2026-03" }, NOW);
      await expect(markBillPaid(bill.id, { periodMonth: "2026-03" }, NOW)).rejects.toThrow(ValidationError);

      const payments = await prisma.recurringBillPayment.count({ where: { billId: bill.id } });
      expect(payments).toBe(1);
    });

    // The core atomicity guarantee: a second (duplicate) markBillPaid call
    // that also asks to log a transaction must roll back the Transaction it
    // tentatively created inside the same prisma.$transaction once the
    // RecurringBillPayment insert hits the [billId, periodMonth] unique
    // constraint -- a RecurringBillPayment row can never exist without its
    // Transaction, or vice versa (see prisma/schema.prisma's comment on
    // RecurringBillPayment.transactionId and
    // server/data/recurringBills.ts's markBillPaid).
    it("rolls back the logged transaction when the duplicate-payment write fails inside the same $transaction", async () => {
      const category = await createTestCategory(DEV_USER_ID, "EXPENSE", "Housing");
      const bill = await createRecurringBill({ name: "Rent", amountCents: 150000, dueDay: 1, categoryId: category.id });

      const first = await markBillPaid(bill.id, { periodMonth: "2026-03", logTransaction: true }, NOW);
      expect(first.transactionId).not.toBeNull();

      await expect(
        markBillPaid(bill.id, { periodMonth: "2026-03", logTransaction: true }, NOW),
      ).rejects.toThrow(ValidationError);

      // Only the first attempt's transaction and payment survive -- the
      // second attempt's Transaction insert (which succeeded before the
      // conflicting RecurringBillPayment insert failed) must have been
      // rolled back along with it, not left as an orphan.
      const transactionCount = await prisma.transaction.count({ where: { userId: DEV_USER_ID } });
      expect(transactionCount).toBe(1);
      const paymentCount = await prisma.recurringBillPayment.count({ where: { billId: bill.id } });
      expect(paymentCount).toBe(1);
    });

    it("throws NotFoundError marking a nonexistent bill paid", async () => {
      await expect(markBillPaid(NONEXISTENT_ID, { periodMonth: "2026-03" }, NOW)).rejects.toThrow(NotFoundError);
    });

    it("cannot mark another user's bill paid", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createRecurringBill({ name: "Theirs", amountCents: 5000, dueDay: 5 });
      actAs(DEV_USER_ID);
      await expect(markBillPaid(theirs.id, { periodMonth: "2026-03" }, NOW)).rejects.toThrow(NotFoundError);

      const payments = await prisma.recurringBillPayment.count({ where: { billId: theirs.id } });
      expect(payments).toBe(0);
    });
  });
});
