import { Money } from "@/components/ui/Money";
import type { DashboardSummaryDTO } from "@/server/data/dashboard";

export function DashboardSummaryCards({
  summary,
  currency,
}: {
  summary: DashboardSummaryDTO;
  currency?: string;
}) {
  const secondaryCards = [
    { label: "Total income", cents: summary.incomeCents },
    { label: "Total expenses", cents: -summary.expenseCents },
  ];

  return (
    <div className="space-y-3">
      {/* This app has no account-balance/net-worth concept -- net cash flow
          (income minus expenses for the period) is its closest equivalent to
          "the one number that matters," so it gets the hero treatment: its
          own full-width card, sized well above the type scale's other
          defined roles, with income/expenses/savings rate demoted to
          supporting figures below. */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm font-medium text-muted">Net cash flow</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          <Money cents={summary.netCents} currency={currency} />
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {secondaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">
              <Money cents={card.cents} currency={currency} />
            </p>
          </div>
        ))}
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Savings rate</p>
          <p className="mt-1 text-2xl font-semibold">
            {summary.savingsRatePercent === null ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">Not available (no income this period)</span>
              </>
            ) : (
              `${summary.savingsRatePercent}%`
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
