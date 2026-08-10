import Link from "next/link";
import { Money } from "@/components/ui/Money";
import type { IncomeVsExpectedDTO } from "@/lib/incomeSources";

interface IncomeStatusSummaryProps {
  status: IncomeVsExpectedDTO;
  currency?: string;
}

// Same slim link/summary pattern as BudgetStatusSummary -- /income is where
// the per-source breakdown lives, this just surfaces the headline number.
export function IncomeStatusSummary({ status, currency }: IncomeStatusSummaryProps) {
  if (status.sources.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm">
          No income sources set up.{" "}
          <Link href="/income" className="font-medium text-accent hover:underline">
            Add one
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm">
        <Money cents={status.totalActualCents} currency={currency} className="font-medium" /> of{" "}
        <Money cents={status.totalExpectedCents} currency={currency} className="font-medium" /> expected income
        received this month
      </p>
      <Link href="/income" className="text-sm font-medium text-accent hover:underline">
        View income
      </Link>
    </section>
  );
}
