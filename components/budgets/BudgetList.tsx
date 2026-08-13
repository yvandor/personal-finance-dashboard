import { BudgetCard } from "./BudgetCard";
import type { BudgetProgressDTO } from "@/server/data/budgets";

interface BudgetListProps {
  budgets: BudgetProgressDTO[];
  currency?: string;
  /** categoryId -> #rrggbb, threaded down to each BudgetCard's CategoryBadge. */
  categoryColors?: Record<string, string>;
  onOptimisticAdd?: (budget: BudgetProgressDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<BudgetProgressDTO>) => void;
  onOptimisticRemove?: (id: string) => void;
}

export function BudgetList({
  budgets,
  currency,
  categoryColors,
  onOptimisticAdd,
  onOptimisticUpdate,
  onOptimisticRemove,
}: BudgetListProps) {
  if (budgets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-4 py-16 text-center">
        <p className="text-sm font-medium">No budgets set for this month yet</p>
        <p className="text-sm text-muted">Add a budget to start tracking spending against a limit.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {budgets.map((budget) => (
        <BudgetCard
          key={budget.id}
          budget={budget}
          currency={currency}
          categoryColor={categoryColors?.[budget.categoryId]}
          onOptimisticAdd={onOptimisticAdd}
          onOptimisticUpdate={onOptimisticUpdate}
          onOptimisticRemove={onOptimisticRemove}
        />
      ))}
    </div>
  );
}
