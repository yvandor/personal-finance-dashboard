import { Money } from "@/components/ui/Money";
import type { DashboardSummaryDTO } from "@/server/data/dashboard";

export function DashboardSummaryCards({
  summary,
  currency,
}: {
  summary: DashboardSummaryDTO;
  currency?: string;
}) {
  const cards = [
    { label: "Total income", cents: summary.incomeCents },
    { label: "Total expenses", cents: -summary.expenseCents },
    { label: "Net cash flow", cents: summary.netCents },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
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
  );
}
