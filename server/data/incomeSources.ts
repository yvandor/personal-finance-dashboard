import "server-only";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  incomeSourceCreateSchema,
  incomeSourceUpdateSchema,
  incomeSourceFilterSchema,
  incomeVsExpectedFilterSchema,
} from "@/lib/schemas/incomeSource";
import { monthKeyRange, currentMonthKey } from "@/lib/dates";
import { computeIncomeVsExpected, type IncomeVsExpectedDTO } from "@/lib/incomeSources";
import type { IncomeSource } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";

// server/data/incomeSources.ts is the only place `prisma.incomeSource` (and
// its relations) is touched -- same invariant as every other DAL module.
// Reads used by pickers (listIncomeSources) stay separate from the
// management-page reads/writes, same split as server/data/categories.ts's
// listCategories vs listCategoriesForManagement.

export interface IncomeSourceDTO {
  id: string;
  name: string;
  amountCents: number;
  payDay: number;
  notes: string | null;
}

function toDTO(row: IncomeSource): IncomeSourceDTO {
  return { id: row.id, name: row.name, amountCents: row.amountCents, payDay: row.payDay, notes: row.notes };
}

/** Active sources only -- feeds every picker (the transaction form's Source dropdown). */
export async function listIncomeSources(rawFilters: unknown = {}): Promise<IncomeSourceDTO[]> {
  const userId = await requireUserId();
  const { isActive } = incomeSourceFilterSchema.parse(rawFilters);
  const rows = await prisma.incomeSource.findMany({
    where: { userId, ...(isActive !== undefined ? { isActive } : {}) },
    orderBy: [{ name: "asc" }],
  });
  return rows.map(toDTO);
}

export interface IncomeSourceManagementDTO extends IncomeSourceDTO {
  isActive: boolean;
  /** Transactions currently tagged to this source -- informational only; archiving is never blocked by this. */
  transactionCount: number;
}

// Includes archived (isActive: false) sources -- the /income management
// list has its own active/archived sections, same as
// listCategoriesForManagement.
export async function listIncomeSourcesForManagement(): Promise<IncomeSourceManagementDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.incomeSource.findMany({
    where: { userId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });
  return rows.map((row) => ({ ...toDTO(row), isActive: row.isActive, transactionCount: row._count.transactions }));
}

function toValidationError(err: unknown): never {
  // The `[userId, name]` unique index (see prisma/schema.prisma) is the
  // real enforcement of "name unique per user" -- same
  // catch-P2002-and-translate pattern as server/data/categories.ts's
  // createCategory.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new ValidationError("An income source with this name already exists.");
  }
  throw err;
}

export async function createIncomeSource(input: unknown): Promise<IncomeSourceDTO> {
  const userId = await requireUserId();
  const data = incomeSourceCreateSchema.parse(input);

  try {
    const created = await prisma.incomeSource.create({
      data: {
        userId,
        name: data.name,
        amountCents: data.amountCents,
        payDay: data.payDay,
        notes: data.notes,
      },
    });
    return toDTO(created);
  } catch (err) {
    return toValidationError(err);
  }
}

// isActive is deliberately not editable here -- see archiveIncomeSource /
// unarchiveIncomeSource below, mirroring updateCategory's comment on `type`.
export async function updateIncomeSource(id: string, input: unknown): Promise<IncomeSourceDTO> {
  const userId = await requireUserId();
  const data = incomeSourceUpdateSchema.parse(input);

  try {
    const result = await prisma.incomeSource.updateMany({
      where: { id, userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.amountCents !== undefined ? { amountCents: data.amountCents } : {}),
        ...(data.payDay !== undefined ? { payDay: data.payDay } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    if (result.count === 0) {
      throw new NotFoundError("Income source not found");
    }
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    return toValidationError(err);
  }

  const updated = await prisma.incomeSource.findFirst({ where: { id, userId } });
  if (!updated) {
    throw new NotFoundError("Income source not found");
  }
  return toDTO(updated);
}

async function setActive(id: string, isActive: boolean): Promise<void> {
  const userId = await requireUserId();
  const result = await prisma.incomeSource.updateMany({ where: { id, userId }, data: { isActive } });
  if (result.count === 0) {
    throw new NotFoundError("Income source not found");
  }
}

// Archiving (never a real prisma.incomeSource.delete()) is the only removal
// action this app exposes for an income source, whether or not it's in use
// -- same reasoning as server/data/categories.ts's archiveCategory. An
// archived source drops out of every picker (listIncomeSources with
// isActive: true) and out of getIncomeVsExpected's per-month breakdown, but
// stays fully intact for every transaction that already references it.
export async function archiveIncomeSource(id: string): Promise<void> {
  return setActive(id, false);
}

export async function unarchiveIncomeSource(id: string): Promise<void> {
  return setActive(id, true);
}

// For the given month, for each ACTIVE income source: expectedCents (its
// flat amountCents) vs actualCents (sum of INCOME transactions tagged to it
// that month). unattributedCents separately sums INCOME transactions that
// month with no incomeSourceId -- money received but not tied to any
// expected source. One query for this month's active sources, one groupBy
// for that month's INCOME transactions (grouped by incomeSourceId, which
// naturally buckets the untagged rows into their own `null` group instead
// of a second query) -- same avoid-N+1 shape as
// server/data/budgets.ts's listBudgetsWithProgress. The actual merge math
// is pure and lives in lib/incomeSources.ts's computeIncomeVsExpected so
// it's unit-testable without the database.
export async function getIncomeVsExpected(rawFilters: unknown = {}): Promise<IncomeVsExpectedDTO> {
  const userId = await requireUserId();
  const { month: rawMonth } = incomeVsExpectedFilterSchema.parse(rawFilters);
  const month = rawMonth ?? currentMonthKey();
  const { start, end } = monthKeyRange(month);

  const [sources, grouped] = await Promise.all([
    prisma.incomeSource.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["incomeSourceId"],
      where: { userId, type: "INCOME", date: { gte: new Date(start), lte: new Date(end) } },
      _sum: { amountCents: true },
    }),
  ]);

  return computeIncomeVsExpected(
    month,
    sources.map((s) => ({ id: s.id, name: s.name, expectedCents: s.amountCents })),
    grouped.map((g) => ({ incomeSourceId: g.incomeSourceId, amountCents: g._sum.amountCents ?? 0 })),
  );
}
