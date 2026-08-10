import { Money } from "@/components/ui/Money";
import { IncomeVsExpectedBar } from "./IncomeVsExpectedBar";
import { computeExpectedProgress } from "@/lib/incomeSources";
import type { IncomeVsExpectedDTO } from "@/lib/incomeSources";

interface IncomeVsExpectedSummaryProps {
  incomeVsExpected: IncomeVsExpectedDTO;
  currency?: string;
}

// The month's expected-vs-received view -- one card per active income
// source (server/data/incomeSources.ts's getIncomeVsExpected already scoped
// this to the selected month and active sources only), plus a totals/
// unattributed footer. Read-only: editing a source's expected amount goes
// through IncomeSourceList's edit dialog below, not from here.
export function IncomeVsExpectedSummary({ incomeVsExpected, currency }: IncomeVsExpectedSummaryProps) {
  const { sources, unattributedCents, totalExpectedCents, totalActualCents } = incomeVsExpected;

  if (sources.length === 0 && unattributedCents === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-4 py-10 text-center">
        <p className="text-sm font-medium">Nothing to show yet</p>
        <p className="text-sm text-muted">Add an active income source to see expected vs. received income here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((source) => {
          const progress = computeExpectedProgress(source.expectedCents, source.actualCents);
          return (
            <div key={source.id} className="rounded-xl border border-border bg-surface p-4">
              <p className="truncate font-medium">{source.name}</p>
              <p className="mt-1 text-sm text-muted">
                <Money cents={source.actualCents} currency={currency} /> of{" "}
                <Money cents={source.expectedCents} currency={currency} />
              </p>
              <div className="mt-3">
                <IncomeVsExpectedBar percentReceived={progress.percentReceived} isFullyReceived={progress.isFullyReceived} />
              </div>
            </div>
          );
        })}
      </div>

      {unattributedCents > 0 && (
        <p className="text-sm text-muted">
          <Money cents={unattributedCents} currency={currency} className="font-medium" /> received this month wasn&apos;t
          tagged to any income source.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <span>
          Expected: <Money cents={totalExpectedCents} currency={currency} className="font-medium" />
        </span>
        <span>
          Received: <Money cents={totalActualCents} currency={currency} className="font-medium" />
        </span>
      </div>
    </div>
  );
}
