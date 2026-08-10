import "server-only";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { budgetCreateSchema, budgetUpdateSchema, budgetFilterSchema } from "@/lib/schemas/budget";
import { monthKeyRange, currentMonthKey } from "@/lib/dates";
import { computeBudgetProgress } from "@/lib/budgets";
import { Prisma } from "@/app/generated/prisma/client";

// This module is the ONLY place `prisma` is referenced for budgets. Every
// exported function calls requireUserId() itself -- same invariant as
// server/data/transactions.ts and server/data/dashboard.ts.
//
// A note on category deletion: Budget.categoryId is `onDelete: Cascade` at
// the database level (see prisma/migrations/*/migration.sql). Hard-deleting
// a category today would silently delete every budget ever set for it --
// but category CRUD doesn't exist yet in this app (server/data/categories.ts
// is read-only), so there is no reachable code path that triggers this. The
// schema already has `Category.isArchived` specifically so a category with
// history is archived, never hard-deleted (see prisma/schema.prisma's
// comment on it) -- whoever builds category management must route deletion
// through that column, not prisma.category.delete(), or this currently-dead
// cascade becomes a live data-loss bug. listBudgetsWithProgress() below
// deliberately resolves category names via the budget's own `include`
// relation rather than the isArchived-filtered listCategories(), so an
// existing budget still displays correctly even for a category that's
// since been archived -- only *new* budget creation should be restricted to
// non-archived categories (see assertBudgetableCategory).

export interface BudgetDTO {
  id: string;
  categoryId: string;
  categoryName: string;
  /** "YYYY-MM" */
  month: string;
  amountCents: number;
  notes: string | null;
}

export interface BudgetProgressDTO extends BudgetDTO {
  spentCents: number;
  /** amountCents - spentCents; negative when over budget. */
  remainingCents: number;
  /** Rounded; not capped at 100, so a genuinely over-budget category reads e.g. 140. */
  percentUsed: number;
  isOverBudget: boolean;
}

function monthOf(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 7);
}

async function assertBudgetableCategory(categoryId: string, userId: string): Promise<{ name: string }> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) {
    throw new NotFoundError("Category not found");
  }
  if (category.type !== "EXPENSE") {
    throw new ValidationError(
      `"${category.name}" is an income category -- budgets only apply to expense categories.`,
    );
  }
  if (category.isArchived) {
    throw new ValidationError(`"${category.name}" is archived and can't have a new budget set.`);
  }
  return { name: category.name };
}

// One query for the month's budgets, one groupBy for that month's expense
// spend per category, joined in memory -- avoids an N+1 query per budget.
// Sorted by percentUsed descending so the budgets most at risk surface
// first, rather than an arbitrary or alphabetical order.
export async function listBudgetsWithProgress(rawFilters: unknown = {}): Promise<BudgetProgressDTO[]> {
  const userId = await requireUserId();
  const { month: rawMonth } = budgetFilterSchema.parse(rawFilters);
  const month = rawMonth ?? currentMonthKey();
  const { start, end } = monthKeyRange(month);

  const [budgets, spendByCategory] = await Promise.all([
    prisma.budget.findMany({
      where: { userId, periodStart: new Date(start) },
      include: { category: { select: { name: true } } },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: new Date(start), lte: new Date(end) } },
      _sum: { amountCents: true },
    }),
  ]);

  const spentByCategoryId = new Map(spendByCategory.map((g) => [g.categoryId, g._sum.amountCents ?? 0]));

  const items = budgets.map((b) => {
    const spentCents = spentByCategoryId.get(b.categoryId) ?? 0;
    const progress = computeBudgetProgress(b.amountCents, spentCents);
    return {
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category.name,
      month: monthOf(b.periodStart),
      amountCents: b.amountCents,
      notes: b.notes,
      spentCents,
      ...progress,
    };
  });

  return items.sort((a, b) => b.percentUsed - a.percentUsed);
}

export interface BudgetStatusSummaryDTO {
  budgetCount: number;
  totalBudgetedCents: number;
  totalSpentCents: number;
  overBudgetCount: number;
}

// Backs the dashboard's budget-status card/link. Reuses
// listBudgetsWithProgress rather than re-querying, so there's exactly one
// place the spend-vs-budget math lives.
export async function getCurrentMonthBudgetStatus(): Promise<BudgetStatusSummaryDTO> {
  const items = await listBudgetsWithProgress({ month: currentMonthKey() });
  return {
    budgetCount: items.length,
    totalBudgetedCents: items.reduce((sum, i) => sum + i.amountCents, 0),
    totalSpentCents: items.reduce((sum, i) => sum + i.spentCents, 0),
    overBudgetCount: items.filter((i) => i.isOverBudget).length,
  };
}

export async function createBudget(input: unknown): Promise<BudgetDTO> {
  const userId = await requireUserId();
  const data = budgetCreateSchema.parse(input);
  const { name } = await assertBudgetableCategory(data.categoryId, userId);
  const { start } = monthKeyRange(data.month);

  try {
    const created = await prisma.budget.create({
      data: {
        userId,
        categoryId: data.categoryId,
        periodStart: new Date(start),
        amountCents: data.amountCents,
        notes: data.notes,
      },
    });
    return {
      id: created.id,
      categoryId: created.categoryId,
      categoryName: name,
      month: data.month,
      amountCents: created.amountCents,
      notes: created.notes,
    };
  } catch (err) {
    // The `[userId, categoryId, periodStart]` unique index (see the
    // migration) is the real enforcement of "one budget per category per
    // month" -- the create form also filters already-budgeted categories
    // out of its dropdown, but that's UX, not the guard.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ValidationError("A budget for this category already exists this month.");
    }
    throw err;
  }
}

export async function updateBudget(id: string, input: unknown): Promise<BudgetDTO> {
  const userId = await requireUserId();
  const data = budgetUpdateSchema.parse(input);

  // `updateMany` (not `update`) so the ownership check is part of the
  // query's `where`, not a separate check-then-write step -- same pattern
  // as server/data/transactions.ts's updateTransaction.
  const result = await prisma.budget.updateMany({
    where: { id, userId },
    data: {
      ...(data.amountCents !== undefined ? { amountCents: data.amountCents } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });
  if (result.count === 0) {
    throw new NotFoundError("Budget not found");
  }

  const updated = await prisma.budget.findFirst({
    where: { id, userId },
    include: { category: { select: { name: true } } },
  });
  if (!updated) {
    throw new NotFoundError("Budget not found");
  }
  return {
    id: updated.id,
    categoryId: updated.categoryId,
    categoryName: updated.category.name,
    month: monthOf(updated.periodStart),
    amountCents: updated.amountCents,
    notes: updated.notes,
  };
}

export async function deleteBudget(id: string): Promise<void> {
  const userId = await requireUserId();
  const result = await prisma.budget.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new NotFoundError("Budget not found");
  }
}
