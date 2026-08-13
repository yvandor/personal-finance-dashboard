import Link from "next/link";
import { Money } from "@/components/ui/Money";
import type { BudgetStatusSummaryDTO } from "@/server/data/budgets";

interface BudgetStatusSummaryProps {
  status: BudgetStatusSummaryDTO;
  currency?: string;
}

// A slim link/summary rather than duplicating the full progress-bar list --
// the /budgets page is where budget detail lives; this just surfaces
// whether anything there needs attention.
export function BudgetStatusSummary({ status, currency }: BudgetStatusSummaryProps) {
  if (status.budgetCount === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm">
          No budgets set for this month.{" "}
          <Link href="/budgets" className="font-medium text-accent hover:underline">
            Set one up
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm">
        <Money cents={status.totalSpentCents} currency={currency} className="font-medium" /> of{" "}
        <Money cents={status.totalBudgetedCents} currency={currency} className="font-medium" /> budgeted this month
        {status.overBudgetCount > 0 && (
          <span className="ml-1 font-medium text-danger">
            · {status.overBudgetCount} {status.overBudgetCount === 1 ? "category" : "categories"} over budget
          </span>
        )}
      </p>
      <Link href="/budgets" className="text-sm font-medium text-accent hover:underline">
        View budgets
      </Link>
    </section>
  );
}
