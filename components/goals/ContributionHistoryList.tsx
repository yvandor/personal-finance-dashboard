import { Money } from "@/components/ui/Money";
import type { ContributionDTO } from "@/server/data/savingsGoals";

interface ContributionHistoryListProps {
  contributions: ContributionDTO[];
  currency?: string;
}

// A negative amountCents is a withdrawal (see prisma/schema.prisma's
// comment on SavingsContribution) -- Money already colors by sign, so a
// withdrawal reads the same red an expense does elsewhere in the app,
// without this component needing its own color logic.
export function ContributionHistoryList({ contributions, currency }: ContributionHistoryListProps) {
  if (contributions.length === 0) {
    return <p className="text-sm text-muted">No contributions yet.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {contributions.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted">
            {c.date}
            {c.note && <span className="ml-1.5">· {c.note}</span>}
          </span>
          <Money cents={c.amountCents} currency={currency} className="shrink-0 font-medium" />
        </li>
      ))}
    </ul>
  );
}
