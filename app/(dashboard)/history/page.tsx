import { getMonthlyHistory } from "@/server/data/history";
import { getCurrentUserCurrency } from "@/server/data/users";
import { historyFilterSchema } from "@/lib/schemas/history";
import { MonthsBackSelector } from "@/components/history/MonthsBackSelector";
import { HistoryTable } from "@/components/history/HistoryTable";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const DEFAULT_MONTHS_BACK = 6;

// A Server Component: reads searchParams and calls the DAL directly, same
// as the dashboard/budgets/transactions pages. No Server Action and no
// client Board wrapper here beyond the small range-selector -- this view
// is entirely read-only, so there's nothing for a useOptimistic overlay to
// update.
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawParams = await searchParams;
  const rawFilters = { monthsBack: toSingle(rawParams.monthsBack) };

  // Parsed once here for the page's own use (MonthsBackSelector's current
  // value); getMonthlyHistory re-parses the same raw input itself, since a
  // DAL function must never trust an already-validated shape from its
  // caller.
  const { monthsBack } = historyFilterSchema.parse(rawFilters);

  const [history, currency] = await Promise.all([getMonthlyHistory(rawFilters), getCurrentUserCurrency()]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">History</h1>
          <p className="text-sm text-muted">Your income, spending, budgets, and bills, month by month.</p>
        </div>
        <MonthsBackSelector monthsBack={monthsBack ?? DEFAULT_MONTHS_BACK} />
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <HistoryTable history={history} currency={currency} />
      </div>
    </div>
  );
}
