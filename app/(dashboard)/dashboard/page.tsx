import Link from "next/link";
import { getDashboardSummary, getMonthlyTrend, getCategoryBreakdown } from "@/server/data/dashboard";
import { listTransactions } from "@/server/data/transactions";
import { listCategories } from "@/server/data/categories";
import { getCurrentUserCurrency } from "@/server/data/users";
import { getCurrentMonthBudgetStatus } from "@/server/data/budgets";
import { listRecurringBills } from "@/server/data/recurringBills";
import { getIncomeVsExpected } from "@/server/data/incomeSources";
import { dashboardFilterSchema } from "@/lib/schemas/dashboard";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { DashboardSummaryCards } from "@/components/dashboard/DashboardSummaryCards";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { BudgetStatusSummary } from "@/components/dashboard/BudgetStatusSummary";
import { UpcomingBillsWidget } from "@/components/dashboard/UpcomingBillsWidget";
import { IncomeStatusSummary } from "@/components/dashboard/IncomeStatusSummary";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// A Server Component: reads searchParams, calls the analytics DAL directly
// (no Server Action needed for a read, same as the transactions page).
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawParams = await searchParams;
  const rawFilters = { period: toSingle(rawParams.period) };

  // Parsed once here for the page's own use (PeriodSelector's current
  // value); each DAL function re-parses the same raw input itself, since a
  // DAL function must never trust an already-validated shape from its
  // caller.
  const { period } = dashboardFilterSchema.parse(rawFilters);

  const [summary, trend, breakdown, recent, categories, currency, budgetStatus, bills, incomeStatus] =
    await Promise.all([
      getDashboardSummary(rawFilters),
      getMonthlyTrend(rawFilters),
      getCategoryBreakdown(rawFilters),
      listTransactions({ take: 5 }),
      listCategories(),
      getCurrentUserCurrency(),
      getCurrentMonthBudgetStatus(),
      listRecurringBills(),
      getIncomeVsExpected(),
    ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">Your income, spending, and savings at a glance.</p>
        </div>
        <PeriodSelector period={period} />
      </div>

      <DashboardSummaryCards summary={summary} currency={currency} />

      <div className="grid gap-3 sm:grid-cols-2">
        <BudgetStatusSummary status={budgetStatus} currency={currency} />
        <IncomeStatusSummary status={incomeStatus} currency={currency} />
      </div>

      <UpcomingBillsWidget bills={bills} currency={currency} />

      <div className="flex justify-end">
        <Link href="/history" className="text-sm font-medium text-accent hover:underline">
          View month-to-month history
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TrendChart data={trend} currency={currency} />
        <CategoryBreakdownChart data={breakdown} currency={currency} />
      </div>

      <RecentTransactions transactions={recent.items} categories={categories} currency={currency} />
    </div>
  );
}
