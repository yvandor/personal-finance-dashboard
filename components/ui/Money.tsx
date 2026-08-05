import { formatCents } from "@/lib/money";

interface MoneyProps {
  /** Already signed by the caller — negative for an outflow, positive for an inflow. */
  cents: number;
  className?: string;
}

/** Display-only. Colors by sign; formatting itself comes from lib/money.ts. */
export function Money({ cents, className = "" }: MoneyProps) {
  const colorClass = cents > 0 ? "text-income" : cents < 0 ? "text-expense" : "";
  return <span className={`tabular-nums ${colorClass} ${className}`}>{formatCents(cents)}</span>;
}
