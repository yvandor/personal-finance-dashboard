import { formatCents } from "@/lib/money";

interface MoneyProps {
  /** Already signed by the caller — negative for an outflow, positive for an inflow. */
  cents: number;
  /** ISO 4217 code, e.g. "USD"/"EUR". Defaults to "USD" for callers that haven't threaded the user's currency through yet. */
  currency?: string;
  className?: string;
}

/**
 * Display-only. Colors by sign; formatting itself comes from lib/money.ts.
 *
 * Zero deliberately gets no color class and inherits the surrounding text
 * color: a zero balance is neither income nor expense, and tinting it green or
 * red would assert a direction the number does not have.
 *
 * Color is never the only carrier of meaning here -- formatCents renders the
 * sign itself -- but --income/--expense are still held to 4.5:1 against every
 * background these land on (see the palette notes in app/globals.css), since
 * amounts render at text-sm.
 */
export function Money({ cents, currency = "USD", className = "" }: MoneyProps) {
  const colorClass = cents > 0 ? "text-income" : cents < 0 ? "text-expense" : "";
  return (
    <span className={["tabular-nums", colorClass, className].filter(Boolean).join(" ")}>
      {formatCents(cents, currency)}
    </span>
  );
}
