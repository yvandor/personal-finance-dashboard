import { Money } from "@/components/ui/Money";
import type { TransactionsSummary } from "@/server/data/transactions";

// Totals for whatever the current filters/list show -- not a full monthly
// dashboard aggregate (that's a later phase). See getTransactionsSummary().
export function SummaryCards({ summary }: { summary: TransactionsSummary }) {
  const cards = [
    { label: "Income", cents: summary.incomeCents },
    { label: "Expenses", cents: -summary.expenseCents },
    { label: "Net", cents: summary.netCents },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold">
            <Money cents={card.cents} />
          </p>
        </div>
      ))}
    </div>
  );
}
