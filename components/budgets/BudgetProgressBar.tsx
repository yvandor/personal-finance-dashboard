interface BudgetProgressBarProps {
  percentUsed: number;
  isOverBudget: boolean;
}

function statusLabel(percentUsed: number, isOverBudget: boolean): string {
  if (isOverBudget) return "Over budget";
  if (percentUsed >= 80) return "Near limit";
  return "On track";
}

function barColorClass(percentUsed: number, isOverBudget: boolean): string {
  if (isOverBudget) return "bg-expense";
  if (percentUsed >= 80) return "bg-amber-500";
  return "bg-income";
}

// Color-banded, but never color-only: the status word ("Over budget" /
// "Near limit" / "On track") carries the same meaning as the color, and the
// bar itself is a real role="progressbar" with the percentage and status
// exposed via aria-valuetext -- a screen reader gets the same information a
// sighted user gets from the color.
export function BudgetProgressBar({ percentUsed, isOverBudget }: BudgetProgressBarProps) {
  // The bar visually caps at 100% (a wider-than-container fill isn't
  // meaningful); the number displayed alongside it does not, so a
  // genuinely over-budget category still reads e.g. "140% used".
  const displayPercent = Math.min(percentUsed, 100);
  const label = statusLabel(percentUsed, isOverBudget);

  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={percentUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percentUsed}% used, ${label}`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-hover ring-1 ring-inset ring-border"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none ${barColorClass(percentUsed, isOverBudget)}`}
          style={{ width: `${displayPercent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        {percentUsed}% used ·{" "}
        <span className={isOverBudget ? "font-medium text-expense" : undefined}>{label}</span>
      </p>
    </div>
  );
}
