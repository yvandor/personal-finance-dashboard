import "server-only";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { listBudgetsWithProgress } from "@/server/data/budgets";
import { historyFilterSchema } from "@/lib/schemas/history";
import { lastNMonths, monthKeyRange } from "@/lib/dates";

// This module is the ONLY place `prisma` is referenced directly for the
// history view's income/expense and bills-paid-ratio numbers. Every
// exported function calls requireUserId() itself, same invariant as
// server/data/dashboard.ts and server/data/budgets.ts. Budget totals are
// deliberately *not* re-derived here -- see getMonthlyHistory's comment.

export interface MonthlyHistoryDTO {
  /** "YYYY-MM" */
  month: string;
  incomeCents: number;
  expenseCents: number;
  /** incomeCents - expenseCents */
  netCents: number;
  totalBudgetedCents: number;
  totalSpentCents: number;
  billsPaidCount: number;
  billsTotalCount: number;
}

const DEFAULT_MONTHS_BACK = 6;

// One set of parallel per-month queries, mirroring
// server/data/dashboard.ts's getMonthlyTrend -- a groupBy per month across
// a bounded (max 24, via historyFilterSchema) range, rather than a single
// raw-SQL date_trunc('month', date) query. See getMonthlyTrend's comment
// for why that tradeoff is fine at this app's stated scale.
export async function getMonthlyHistory(rawFilters: unknown = {}): Promise<MonthlyHistoryDTO[]> {
  const userId = await requireUserId();
  const { monthsBack } = historyFilterSchema.parse(rawFilters);
  const months = lastNMonths(monthsBack ?? DEFAULT_MONTHS_BACK, new Date());

  // The bills denominator isn't month-scoped: RecurringBill has no record
  // of when a bill became active, so every row in this history table is
  // compared against today's active bill set, not that historical month's
  // set -- the same "current state only" limitation
  // getCurrentMonthBudgetStatus (server/data/budgets.ts) accepts for
  // pre-history-tracking data. Fetched once outside the per-month
  // Promise.all since it's the same value for every row.
  const billsTotalCount = await prisma.recurringBill.count({ where: { userId, isActive: true } });

  return Promise.all(
    months.map(async (month) => {
      const { start, end } = monthKeyRange(month);

      const [txGrouped, budgetProgress, billsPaidCount] = await Promise.all([
        prisma.transaction.groupBy({
          by: ["type"],
          where: { userId, date: { gte: new Date(start), lte: new Date(end) } },
          _sum: { amountCents: true },
        }),
        // Reuses listBudgetsWithProgress rather than re-deriving the
        // budget/spend-matching logic a second time -- same reasoning as
        // getCurrentMonthBudgetStatus in server/data/budgets.ts, just
        // called once per month in this range instead of only the current
        // month. Its own requireUserId() call is a no-op re-read thanks to
        // React's cache() wrapper (see server/context.ts).
        listBudgetsWithProgress({ month }),
        // No DAL layer exists yet for RecurringBillPayment (the "bills"
        // slice owns server/data/recurringBills.ts, built in a separate
        // worktree) -- this is a minimal, self-contained query directly
        // against the stable Prisma model rather than an import of a file
        // that doesn't exist in this worktree.
        prisma.recurringBillPayment.count({ where: { userId, periodMonth: month } }),
      ]);

      const incomeCents = txGrouped.find((g) => g.type === "INCOME")?._sum.amountCents ?? 0;
      const expenseCents = txGrouped.find((g) => g.type === "EXPENSE")?._sum.amountCents ?? 0;

      return {
        month,
        incomeCents,
        expenseCents,
        netCents: incomeCents - expenseCents,
        totalBudgetedCents: budgetProgress.reduce((sum, b) => sum + b.amountCents, 0),
        totalSpentCents: budgetProgress.reduce((sum, b) => sum + b.spentCents, 0),
        billsPaidCount,
        billsTotalCount,
      };
    }),
  );
}
