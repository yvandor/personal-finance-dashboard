interface IncomeVsExpectedBarProps {
  percentReceived: number;
  isFullyReceived: boolean;
}

function statusLabel(percentReceived: number, isFullyReceived: boolean): string {
  if (isFullyReceived) return "Fully received";
  if (percentReceived >= 80) return "Nearly received";
  return "Awaiting";
}

function barColorClass(isFullyReceived: boolean): string {
  return isFullyReceived ? "bg-income" : "bg-amber-500";
}

// Mirrors components/budgets/BudgetProgressBar.tsx's shape (a real
// role="progressbar" with the percentage and status exposed via
// aria-valuetext, not color-only) for the inverse framing: progress toward
// *receiving* an expected amount rather than progress toward a spending
// limit.
export function IncomeVsExpectedBar({ percentReceived, isFullyReceived }: IncomeVsExpectedBarProps) {
  const displayPercent = Math.min(Math.max(percentReceived, 0), 100);
  const label = statusLabel(percentReceived, isFullyReceived);

  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={percentReceived}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percentReceived}% received, ${label}`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-hover"
      >
        <div
          className={`h-full rounded-full transition-all ${barColorClass(isFullyReceived)}`}
          style={{ width: `${displayPercent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        {percentReceived}% received ·{" "}
        <span className={isFullyReceived ? "font-medium text-income" : undefined}>{label}</span>
      </p>
    </div>
  );
}
