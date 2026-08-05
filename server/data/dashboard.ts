import "server-only";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { listCategories } from "@/server/data/categories";
import { dashboardFilterSchema } from "@/lib/schemas/dashboard";
import { resolvePeriodRange, monthKeyRange } from "@/lib/dates";

// This module is the ONLY place `prisma` is referenced for dashboard
// analytics. Every exported function calls requireUserId() itself rather
// than accepting a userId parameter, exactly like server/data/transactions.ts
// -- there is no signature anywhere for a caller to pass a different user's
// id through.

export interface DashboardSummaryDTO {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  /** Rounded to 1 decimal place; null when incomeCents is 0 (guarded against divide-by-zero, never NaN/Infinity). */
  savingsRatePercent: number | null;
}

export async function getDashboardSummary(rawFilters: unknown = {}): Promise<DashboardSummaryDTO> {
  const userId = await requireUserId();
  const { period } = dashboardFilterSchema.parse(rawFilters);
  const { dateFrom, dateTo } = resolvePeriodRange(period);

  const grouped = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, date: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
    _sum: { amountCents: true },
  });

  const incomeCents = grouped.find((g) => g.type === "INCOME")?._sum.amountCents ?? 0;
  const expenseCents = grouped.find((g) => g.type === "EXPENSE")?._sum.amountCents ?? 0;
  const netCents = incomeCents - expenseCents;

  return {
    incomeCents,
    expenseCents,
    netCents,
    savingsRatePercent: incomeCents > 0 ? Math.round((netCents / incomeCents) * 1000) / 10 : null,
  };
}

export interface MonthlyTrendPointDTO {
  /** "YYYY-MM" */
  month: string;
  incomeCents: number;
  expenseCents: number;
}

// One groupBy per month in the period (bounded at 12, for "current year")
// rather than a single query with a raw-SQL date_trunc('month', date)
// bucket -- Prisma's groupBy can't express that, and at this app's stated
// scale (tens of thousands of rows per user, not millions -- see
// docs/PROJECT_PLAN.md §6) a handful of parallel indexed queries against
// [userId, type, date] is simpler and just as fast as raw SQL would be.
export async function getMonthlyTrend(rawFilters: unknown = {}): Promise<MonthlyTrendPointDTO[]> {
  const userId = await requireUserId();
  const { period } = dashboardFilterSchema.parse(rawFilters);
  const { monthKeys } = resolvePeriodRange(period);

  return Promise.all(
    monthKeys.map(async (month) => {
      const { start, end } = monthKeyRange(month);
      const grouped = await prisma.transaction.groupBy({
        by: ["type"],
        where: { userId, date: { gte: new Date(start), lte: new Date(end) } },
        _sum: { amountCents: true },
      });
      return {
        month,
        incomeCents: grouped.find((g) => g.type === "INCOME")?._sum.amountCents ?? 0,
        expenseCents: grouped.find((g) => g.type === "EXPENSE")?._sum.amountCents ?? 0,
      };
    }),
  );
}

export interface CategoryBreakdownItemDTO {
  categoryName: string;
  totalCents: number;
}

const CATEGORY_BREAKDOWN_TOP_N = 6;

// Expense composition for the period, largest first, collapsed to the top
// categories plus a synthesized "Other" bucket -- an unbounded per-category
// legend stops being readable well before a user has accumulated dozens of
// categories. The exact cutoff (6) is a placeholder judgment call, called
// out as an open item in docs/PROJECT_PLAN.md rather than a settled design.
export async function getCategoryBreakdown(rawFilters: unknown = {}): Promise<CategoryBreakdownItemDTO[]> {
  const userId = await requireUserId();
  const { period } = dashboardFilterSchema.parse(rawFilters);
  const { dateFrom, dateTo } = resolvePeriodRange(period);

  const [grouped, categories] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: new Date(dateFrom), lte: new Date(dateTo) } },
      _sum: { amountCents: true },
    }),
    listCategories(),
  ]);

  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const items = grouped
    .map((g) => ({
      categoryName: g.categoryId ? (nameById.get(g.categoryId) ?? "Uncategorized") : "Uncategorized",
      totalCents: g._sum.amountCents ?? 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  if (items.length <= CATEGORY_BREAKDOWN_TOP_N + 1) {
    return items;
  }

  const top = items.slice(0, CATEGORY_BREAKDOWN_TOP_N);
  const otherTotal = items.slice(CATEGORY_BREAKDOWN_TOP_N).reduce((sum, i) => sum + i.totalCents, 0);
  return [...top, { categoryName: "Other", totalCents: otherTotal }];
}
