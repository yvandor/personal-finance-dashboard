import { listIncomeSourcesForManagement, getIncomeVsExpected } from "@/server/data/incomeSources";
import { getCurrentUserCurrency } from "@/server/data/users";
import { currentMonthKey } from "@/lib/dates";
import { IncomeSourcesBoard } from "@/components/income/IncomeSourcesBoard";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// A Server Component: reads searchParams, calls the DAL directly (no
// Server Action needed for a read), and hands the results to
// IncomeSourcesBoard (a client component), which owns the useOptimistic
// overlay shared by the header's create dialog and the management list
// below it. Writes go through server/actions/incomeSources.ts. Mirrors
// app/(dashboard)/budgets/page.tsx's month-scoped shape.
export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawParams = await searchParams;
  const month = toSingle(rawParams.month) ?? currentMonthKey();

  const [incomeSources, incomeVsExpected, currency] = await Promise.all([
    listIncomeSourcesForManagement(),
    getIncomeVsExpected({ month }),
    getCurrentUserCurrency(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <IncomeSourcesBoard
        incomeSources={incomeSources}
        incomeVsExpected={incomeVsExpected}
        month={month}
        currency={currency}
      />
    </div>
  );
}
