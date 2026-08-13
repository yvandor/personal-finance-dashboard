import { Money } from "@/components/ui/Money";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { BudgetFormDialog } from "./BudgetFormDialog";
import { DeleteBudgetButton } from "./DeleteBudgetButton";
import type { BudgetProgressDTO } from "@/server/data/budgets";

// Shared by every icon-only trigger on this card (edit here, delete inside
// DeleteBudgetButton) -- same rounded-md chip + focus-visible ring as
// components/ui/Modal.tsx's close button, the frozen primitive this pattern
// is modeled on.
export const ICON_BUTTON_CLASSES =
  "rounded-md p-2.5 text-muted outline-none transition-colors hover:bg-surface-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface BudgetCardProps {
  budget: BudgetProgressDTO;
  currency?: string;
  /** The budget's category color (#rrggbb), for the CategoryBadge dot. Falls back to a neutral token when unknown (e.g. an archived category). */
  categoryColor?: string;
  onOptimisticAdd?: (budget: BudgetProgressDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<BudgetProgressDTO>) => void;
  onOptimisticRemove?: (id: string) => void;
}

export function BudgetCard({
  budget,
  currency,
  categoryColor,
  onOptimisticAdd,
  onOptimisticUpdate,
  onOptimisticRemove,
}: BudgetCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <CategoryBadge name={budget.categoryName} color={categoryColor ?? "var(--muted)"} className="text-sm font-medium" />
          <p className="mt-0.5 text-sm text-muted">
            <Money cents={budget.spentCents} currency={currency} /> of{" "}
            <Money cents={budget.amountCents} currency={currency} />
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <BudgetFormDialog
            mode="edit"
            budget={budget}
            month={budget.month}
            triggerClassName={ICON_BUTTON_CLASSES}
            triggerAriaLabel={`Edit budget for ${budget.categoryName}`}
            onOptimisticUpdate={onOptimisticUpdate}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </BudgetFormDialog>
          <DeleteBudgetButton budget={budget} onOptimisticAdd={onOptimisticAdd} onOptimisticRemove={onOptimisticRemove} />
        </div>
      </div>

      <div className="mt-3">
        <BudgetProgressBar percentUsed={budget.percentUsed} isOverBudget={budget.isOverBudget} />
      </div>

      <p className="mt-2 text-sm">
        {/* Money colors by sign already -- negative (over budget) renders red, matching the rest of the app's convention. */}
        <Money cents={budget.remainingCents} currency={currency} className="font-medium" />{" "}
        <span className="text-muted">{budget.remainingCents < 0 ? "over budget" : "remaining"}</span>
      </p>
    </div>
  );
}
