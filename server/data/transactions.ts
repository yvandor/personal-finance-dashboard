import "server-only";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { ValidationError } from "@/lib/errors";
import { authzDenied } from "@/server/logger";
import {
  transactionCreateSchema,
  transactionUpdateSchema,
  transactionFilterSchema,
} from "@/lib/schemas/transaction";
import type { TransactionType } from "@/app/generated/prisma/enums";
import type { Prisma, Transaction } from "@/app/generated/prisma/client";

// This module is the ONLY place `prisma` is referenced for transactions.
// Every exported function calls requireUserId() itself rather than
// accepting a userId parameter — see server/context.ts for why that's the
// control that makes cross-user access structurally impossible, not just
// reviewed-for.

export interface TransactionDTO {
  id: string;
  userId: string;
  type: TransactionType;
  amountCents: number;
  date: string; // YYYY-MM-DD
  description: string;
  notes: string | null;
  categoryId: string | null;
  // Optional link to the IncomeSource this transaction fulfills -- see
  // lib/incomeSources.ts's getIncomeVsExpected, which reads this column.
  incomeSourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDTO(row: Transaction): TransactionDTO {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    amountCents: row.amountCents,
    date: toDateOnly(row.date),
    description: row.description,
    notes: row.notes,
    categoryId: row.categoryId,
    incomeSourceId: row.incomeSourceId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Postgres ILIKE treats %, _, and \ as pattern metacharacters even though
// the value itself is parameterized (parameterization stops SQL injection,
// it does not stop wildcard injection). Escaping them with a backslash —
// Postgres's default LIKE escape character — makes a literal search for
// e.g. "50%" match the substring "50%" instead of "50" followed by anything.
function escapeLikeWildcards(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// A transaction may only reference a category that (a) exists, (b) is
// owned by the same user, and (c) is typed the same way (an expense
// transaction can't be filed under an income category). This is checked
// here, in application code, as a data-integrity rule the CHECK constraints
// don't cover — same-owner is additionally enforced at the database via the
// transactions_category_same_owner composite foreign key, so a bug here
// would fail loudly at the database rather than silently leak data.
async function assertUsableCategory(
  categoryId: string,
  userId: string,
  expectedType: TransactionType,
): Promise<void> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  });
  if (!category) {
    throw authzDenied("category", categoryId);
  }
  if (category.type !== expectedType) {
    throw new ValidationError(
      `Category "${category.name}" is a ${category.type} category and cannot be used on a ${expectedType} transaction`,
    );
  }
}

// A transaction may only reference an income source that (a) exists and
// (b) is owned by the same user -- same-owner check as
// assertUsableCategory. The type match (only an INCOME transaction can
// carry a source) is application-level only, not a database constraint --
// see prisma/schema.prisma's comment on Transaction.incomeSourceId.
async function assertUsableIncomeSource(
  incomeSourceId: string,
  userId: string,
  transactionType: TransactionType,
): Promise<void> {
  const source = await prisma.incomeSource.findFirst({
    where: { id: incomeSourceId, userId },
  });
  if (!source) {
    throw authzDenied("incomeSource", incomeSourceId);
  }
  if (transactionType !== "INCOME") {
    throw new ValidationError("An income source can only be linked to an income transaction");
  }
}

function buildWhere(
  userId: string,
  filters: ReturnType<typeof transactionFilterSchema.parse>,
): Prisma.TransactionWhereInput {
  return {
    userId,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          date: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          description: {
            contains: escapeLikeWildcards(filters.q),
            mode: "insensitive" as const,
          },
        }
      : {}),
  };
}

interface Cursor {
  date: string;
  id: string;
}

function encodeCursor(row: Pick<Transaction, "date" | "id">): string {
  return `${toDateOnly(row.date)}_${row.id}`;
}

// The schema's regex already guarantees this shape, so this never throws --
// it's a plain split, not a second validation pass.
function decodeCursor(cursor: string): Cursor {
  const separatorIndex = cursor.indexOf("_");
  return { date: cursor.slice(0, separatorIndex), id: cursor.slice(separatorIndex + 1) };
}

// Keyset ("(date, id) < cursor") rather than `skip` -- the row-comparison
// needs BOTH columns, not just `date`, or two transactions sharing a date
// would be split unpredictably between pages (a row could be skipped
// entirely, or repeated on both pages, depending on where Postgres happened
// to put it within that date). `id` is the tiebreaker for a reason: it's
// unique, so "same date, smaller id" is always well-defined and never ties.
//
// `after` follows the [userId, date desc, id desc] index's own order
// (strictly further down the list); `before` is its mirror, used for the
// "Previous" direction.
function afterCursor(cursor: Cursor): Prisma.TransactionWhereInput {
  return {
    OR: [{ date: { lt: new Date(cursor.date) } }, { date: new Date(cursor.date), id: { lt: cursor.id } }],
  };
}

function beforeCursor(cursor: Cursor): Prisma.TransactionWhereInput {
  return {
    OR: [{ date: { gt: new Date(cursor.date) } }, { date: new Date(cursor.date), id: { gt: cursor.id } }],
  };
}

export interface ListTransactionsResult {
  items: TransactionDTO[];
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
}

export async function listTransactions(rawFilters: unknown = {}): Promise<ListTransactionsResult> {
  const userId = await requireUserId();
  const filters = transactionFilterSchema.parse(rawFilters);
  const baseWhere = buildWhere(userId, filters);
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
  const goingPrev = cursor !== null && filters.direction === "prev";

  // Fetch one extra row beyond the page size ("peek") so hasNext/hasPrev
  // are answered by the query itself -- no separate existence check, no
  // relying on a total count that a `skip`-free design otherwise wouldn't
  // need at all (kept below only because the UI still displays it).
  const where: Prisma.TransactionWhereInput = cursor
    ? { AND: [baseWhere, goingPrev ? beforeCursor(cursor) : afterCursor(cursor)] }
    : baseWhere;
  const orderBy: Prisma.TransactionOrderByWithRelationInput[] = goingPrev
    ? [{ date: "asc" }, { id: "asc" }]
    : [{ date: "desc" }, { id: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({ where, orderBy, take: filters.take + 1 }),
    prisma.transaction.count({ where: baseWhere }),
  ]);

  const hasExtra = rows.length > filters.take;
  const pageRows = hasExtra ? rows.slice(0, filters.take) : rows;
  // `beforeCursor` fetches ascending (nearest-to-cursor first) so the
  // `take + 1` peek trims the right end; flip back to the usual
  // newest-first display order before returning.
  const orderedRows = goingPrev ? pageRows.reverse() : pageRows;

  const hasNext = goingPrev ? true : hasExtra;
  const hasPrev = goingPrev ? hasExtra : cursor !== null;

  return {
    items: orderedRows.map(toDTO),
    total,
    hasNext,
    hasPrev,
    nextCursor: orderedRows.length > 0 ? encodeCursor(orderedRows[orderedRows.length - 1]) : null,
    prevCursor: orderedRows.length > 0 ? encodeCursor(orderedRows[0]) : null,
  };
}

export interface TransactionsSummary {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  count: number;
}

// Summary for whatever the current filters/list show (e.g. the transaction
// page's summary cards) -- not a monthly dashboard aggregate. It reuses the
// exact same `where` as listTransactions so the numbers always describe the
// same rows the table below them is showing.
export async function getTransactionsSummary(rawFilters: unknown = {}): Promise<TransactionsSummary> {
  const userId = await requireUserId();
  const filters = transactionFilterSchema.parse(rawFilters);
  const where = buildWhere(userId, filters);

  const grouped = await prisma.transaction.groupBy({
    by: ["type"],
    where,
    _sum: { amountCents: true },
    _count: true,
  });

  const income = grouped.find((g) => g.type === "INCOME");
  const expense = grouped.find((g) => g.type === "EXPENSE");
  const incomeCents = income?._sum.amountCents ?? 0;
  const expenseCents = expense?._sum.amountCents ?? 0;

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    count: (income?._count ?? 0) + (expense?._count ?? 0),
  };
}

export async function getTransaction(id: string): Promise<TransactionDTO | null> {
  const userId = await requireUserId();
  const row = await prisma.transaction.findFirst({ where: { id, userId } });
  return row ? toDTO(row) : null;
}

export async function createTransaction(input: unknown): Promise<TransactionDTO> {
  const userId = await requireUserId();
  const data = transactionCreateSchema.parse(input);

  await assertUsableCategory(data.categoryId, userId, data.type);
  if (data.incomeSourceId) {
    await assertUsableIncomeSource(data.incomeSourceId, userId, data.type);
  }

  const created = await prisma.transaction.create({
    data: {
      userId,
      type: data.type,
      amountCents: data.amountCents,
      date: new Date(data.date),
      description: data.description,
      notes: data.notes,
      categoryId: data.categoryId,
      incomeSourceId: data.incomeSourceId ?? null,
    },
  });

  return toDTO(created);
}

export async function updateTransaction(id: string, input: unknown): Promise<TransactionDTO> {
  const userId = await requireUserId();
  const data = transactionUpdateSchema.parse(input);

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) {
    throw authzDenied("transaction", id);
  }

  if (data.categoryId) {
    const effectiveType = data.type ?? existing.type;
    await assertUsableCategory(data.categoryId, userId, effectiveType);
  }
  if (data.incomeSourceId) {
    const effectiveType = data.type ?? existing.type;
    await assertUsableIncomeSource(data.incomeSourceId, userId, effectiveType);
  }

  // `updateMany` (not `update`) so the ownership check is part of the
  // query's `where`, not a separate check-then-write step: a mismatched
  // owner updates zero rows atomically rather than racing a prior read.
  const result = await prisma.transaction.updateMany({
    where: { id, userId },
    data: {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    },
  });

  if (result.count === 0) {
    throw authzDenied("transaction", id);
  }

  const updated = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!updated) {
    throw authzDenied("transaction", id);
  }
  return toDTO(updated);
}

export async function deleteTransaction(id: string): Promise<void> {
  const userId = await requireUserId();
  const result = await prisma.transaction.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw authzDenied("transaction", id);
  }
}
