import { formatCents } from "@/lib/money";

interface MoneyProps {
  /** Already signed by the caller — negative for an outflow, positive for an inflow. */
  cents: number;
  /** ISO 4217 code, e.g. "USD"/"EUR". Defaults to "USD" for callers that haven't threaded the user's currency through yet. */
  currency?: string;
  className?: string;
}

/** Display-only. Colors by sign; formatting itself comes from lib/money.ts. */
export function Money({ cents, currency = "USD", className = "" }: MoneyProps) {
  const colorClass = cents > 0 ? "text-income" : cents < 0 ? "text-expense" : "";
  return <span className={`tabular-nums ${colorClass} ${className}`}>{formatCents(cents, currency)}</span>;
}
