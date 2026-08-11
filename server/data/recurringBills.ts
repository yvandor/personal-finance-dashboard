import "server-only";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { authzDenied } from "@/server/logger";
import { recurringBillCreateSchema, recurringBillUpdateSchema, markBillPaidSchema } from "@/lib/schemas/recurringBill";
import { computeBillStatus, type BillStatus } from "@/lib/recurringBills";
import { currentMonthKey } from "@/lib/dates";
import type { RecurringBill } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";

// server/data/recurringBills.ts is the ONLY place `prisma.recurringBill` and
// `prisma.recurringBillPayment` are touched -- same invariant as every other
// DAL module. Reminder-only, matching prisma/schema.prisma's comment on
// RecurringBill: nothing here auto-creates a Transaction on a due date --
// the only write that can create one is markBillPaid, and only when the
// caller opts in via `logTransaction`.

export interface RecurringBillDTO {
  id: string;
  name: string;
  amountCents: number;
  dueDay: number;
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface RecurringBillWithStatusDTO extends RecurringBillDTO {
  /** Whether a RecurringBillPayment row exists for this bill for the current calendar month. */
  isPaidThisMonth: boolean;
  status: BillStatus;
  /** This period's due date, "YYYY-MM-DD" -- see lib/recurringBills.ts's computeBillStatus. */
  dueDate: string;
  /** Negative once the due date has passed. */
  daysUntilDue: number;
}

function toDTO(row: RecurringBill, categoryName: string | null): RecurringBillDTO {
  return {
    id: row.id,
    name: row.name,
    amountCents: row.amountCents,
    dueDay: row.dueDay,
    categoryId: row.categoryId,
    categoryName,
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

function toStatusDTO(
  row: RecurringBill,
  categoryName: string | null,
  isPaidThisMonth: boolean,
  now: Date,
): RecurringBillWithStatusDTO {
  const { status, dueDate, daysUntilDue } = computeBillStatus({ dueDay: row.dueDay, isPaid: isPaidThisMonth, now });
  return { ...toDTO(row, categoryName), isPaidThisMonth, status, dueDate, daysUntilDue };
}

// One query for the bills, one for this month's payments, joined in memory
// -- avoids an N+1 query per bill, same shape as
// server/data/budgets.ts's listBudgetsWithProgress. Active bills sort by due
// day (soonest first); archived bills trail behind -- same isActive-first
// ordering as server/data/categories.ts's listCategoriesForManagement, so
// the management page can still show/restore an archived bill without a
// separate query.
export async function listRecurringBills(now: Date = new Date()): Promise<RecurringBillWithStatusDTO[]> {
  const userId = await requireUserId();
  const monthKey = currentMonthKey(now);

  const [bills, payments] = await Promise.all([
    prisma.recurringBill.findMany({
      where: { userId },
      orderBy: [{ isActive: "desc" }, { dueDay: "asc" }, { name: "asc" }],
      include: { category: { select: { name: true } } },
    }),
    prisma.recurringBillPayment.findMany({
      where: { userId, periodMonth: monthKey },
      select: { billId: true },
    }),
  ]);

  const paidBillIds = new Set(payments.map((p) => p.billId));
  return bills.map((b) => toStatusDTO(b, b.category?.name ?? null, paidBillIds.has(b.id), now));
}

// The `[userId, name]` unique index (see the migration) is the real
// enforcement of "name unique per user" -- same catch-P2002-and-translate
// pattern as server/data/categories.ts's createCategory.
function toValidationError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new ValidationError("A recurring bill with this name already exists.");
  }
  throw err;
}

// A bill's categoryId, when set, must be one of the user's own, non-archived
// EXPENSE categories -- markBillPaid's optional "log a transaction" path
// always creates an EXPENSE transaction (see prisma/schema.prisma's comment
// on RecurringBill.categoryId), so an income category or someone else's
// category could never be used validly here -- same reasoning as
// server/data/budgets.ts's assertBudgetableCategory.
async function assertBillableCategory(categoryId: string, userId: string): Promise<{ name: string }> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) {
    throw authzDenied("category", categoryId);
  }
  if (category.type !== "EXPENSE") {
    throw new ValidationError(
      `"${category.name}" is an income category -- a bill can only log an expense transaction.`,
    );
  }
  if (category.isArchived) {
    throw new ValidationError(`"${category.name}" is archived and can't be assigned to a bill.`);
  }
  return { name: category.name };
}

export async function createRecurringBill(input: unknown): Promise<RecurringBillDTO> {
  const userId = await requireUserId();
  const data = recurringBillCreateSchema.parse(input);

  let categoryName: string | null = null;
  if (data.categoryId) {
    categoryName = (await assertBillableCategory(data.categoryId, userId)).name;
  }

  try {
    const created = await prisma.recurringBill.create({
      data: {
        userId,
        name: data.name,
        amountCents: data.amountCents,
        dueDay: data.dueDay,
        categoryId: data.categoryId ?? null,
        notes: data.notes,
      },
    });
    return toDTO(created, categoryName);
  } catch (err) {
    return toValidationError(err);
  }
}

export async function updateRecurringBill(id: string, input: unknown): Promise<RecurringBillDTO> {
  const userId = await requireUserId();
  const data = recurringBillUpdateSchema.parse(input);

  if (data.categoryId) {
    await assertBillableCategory(data.categoryId, userId);
  }

  try {
    // `updateMany` (not `update`) so the ownership check is part of the
    // query's `where` -- same pattern as every other DAL's update function.
    const result = await prisma.recurringBill.updateMany({
      where: { id, userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.amountCents !== undefined ? { amountCents: data.amountCents } : {}),
        ...(data.dueDay !== undefined ? { dueDay: data.dueDay } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    if (result.count === 0) {
      throw authzDenied("recurringBill", id);
    }
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    return toValidationError(err);
  }

  const updated = await prisma.recurringBill.findFirst({
    where: { id, userId },
    include: { category: { select: { name: true } } },
  });
  if (!updated) {
    throw authzDenied("recurringBill", id);
  }
  return toDTO(updated, updated.category?.name ?? null);
}

async function setActive(id: string, isActive: boolean): Promise<void> {
  const userId = await requireUserId();
  const result = await prisma.recurringBill.updateMany({ where: { id, userId }, data: { isActive } });
  if (result.count === 0) {
    throw authzDenied("recurringBill", id);
  }
}

// Archiving (isActive: false), never a real prisma.recurringBill.delete() --
// a bill's payment history (RecurringBillPayment) must survive it going
// inactive, the same "labels don't delete history" reasoning as
// server/data/categories.ts's archiveCategory. listRecurringBills still
// returns an archived bill (ordered last) so the management page can show
// and restore it; callers that only want live reminders filter isActive
// themselves (see components/bills/BillList.tsx).
export async function archiveRecurringBill(id: string): Promise<void> {
  return setActive(id, false);
}

export async function unarchiveRecurringBill(id: string): Promise<void> {
  return setActive(id, true);
}

export interface MarkBillPaidResult {
  bill: RecurringBillWithStatusDTO;
  paymentId: string;
  transactionId: string | null;
}

// Records this month's payment and, when `logTransaction` is set, an
// EXPENSE transaction for it -- both writes happen inside one
// prisma.$transaction so a RecurringBillPayment row can never exist without
// its Transaction, or vice versa, when that option was chosen (see
// prisma/schema.prisma's comment on RecurringBillPayment.transactionId).
export async function markBillPaid(
  billId: string,
  input: unknown,
  now: Date = new Date(),
): Promise<MarkBillPaidResult> {
  const userId = await requireUserId();
  const data = markBillPaidSchema.parse(input);

  const bill = await prisma.recurringBill.findFirst({
    where: { id: billId, userId },
    include: { category: { select: { name: true } } },
  });
  if (!bill) {
    throw authzDenied("recurringBill", billId);
  }
  if (data.logTransaction && !bill.categoryId) {
    throw new ValidationError(
      `"${bill.name}" has no category set, so a transaction can't be logged for it. Add a category first, or mark it paid without logging a transaction.`,
    );
  }

  try {
    const { paymentId, transactionId } = await prisma.$transaction(async (tx) => {
      let createdTransactionId: string | null = null;
      if (data.logTransaction && bill.categoryId) {
        const transaction = await tx.transaction.create({
          data: {
            userId,
            type: "EXPENSE",
            amountCents: bill.amountCents,
            date: new Date(data.date ?? now.toISOString().slice(0, 10)),
            description: bill.name,
            categoryId: bill.categoryId,
          },
        });
        createdTransactionId = transaction.id;
      }
      const payment = await tx.recurringBillPayment.create({
        data: {
          userId,
          billId: bill.id,
          periodMonth: data.periodMonth,
          transactionId: createdTransactionId,
        },
      });
      return { paymentId: payment.id, transactionId: createdTransactionId };
    });

    return {
      bill: toStatusDTO(bill, bill.category?.name ?? null, true, now),
      paymentId,
      transactionId,
    };
  } catch (err) {
    // The `[billId, periodMonth]` unique index (see the migration) is the
    // real enforcement of "one payment per bill per month".
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ValidationError(`"${bill.name}" is already marked paid for ${data.periodMonth}.`);
    }
    throw err;
  }
}
