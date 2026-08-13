"use client";

import { useOptimistic } from "react";
import { budgetOptimisticReducer } from "@/lib/budgets";
import { MonthSelector } from "./MonthSelector";
import { BudgetFormDialog } from "./BudgetFormDialog";
import { BudgetList } from "./BudgetList";
import { CopyLastMonthBudgetsButton } from "./CopyLastMonthBudgetsButton";
import type { BudgetProgressDTO } from "@/server/data/budgets";
import type { CategoryDTO } from "@/server/data/categories";

interface BudgetsBoardProps {
  budgets: BudgetProgressDTO[];
  availableCategories: CategoryDTO[];
  /** categoryId -> #rrggbb, for BudgetCard's CategoryBadge dot. See page.tsx's comment on why this is a plain lookup, not a new fetch. */
  categoryColors?: Record<string, string>;
  month: string;
  currency?: string;
}

// Mirrors components/ui/Button.tsx's primary/secondary variants exactly
// (shared base classes, focus-visible ring, disabled treatment) -- these
// two triggers render as plain <button>s (via BudgetFormDialog's own
// trigger and CopyLastMonthBudgetsButton) rather than <Button> itself, so
// the classes are duplicated here rather than imported.
const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 bg-accent text-accent-foreground hover:opacity-90";
const SECONDARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 border border-border-strong bg-surface text-foreground hover:bg-surface-hover";

// Owns the useOptimistic overlay so the header's "Add budget" trigger and
// the list below it share one optimistic array (see lib/budgets.ts's
// budgetOptimisticReducer for the three actions this supports). Both need
// to be inside the SAME client component for that sharing to work, which is
// why this now owns the header row too, not just app/(dashboard)/budgets/page.tsx.
// When `budgets` changes (e.g. navigating to a different month via
// MonthSelector), useOptimistic resets to that new base automatically --
// no stale optimistic row can leak across a month change.
export function BudgetsBoard({ budgets, availableCategories, categoryColors, month, currency }: BudgetsBoardProps) {
  const [optimisticBudgets, dispatch] = useOptimistic(budgets, budgetOptimisticReducer);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted">Set monthly limits per category and track spending against them.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector month={month} />
          <CopyLastMonthBudgetsButton month={month} className={SECONDARY_BUTTON_CLASSES} />
          <BudgetFormDialog
            mode="create"
            categories={availableCategories}
            month={month}
            triggerClassName={PRIMARY_BUTTON_CLASSES}
            onOptimisticAdd={(budget) => dispatch({ type: "add", budget })}
          >
            Add budget
          </BudgetFormDialog>
        </div>
      </div>

      <BudgetList
        budgets={optimisticBudgets}
        currency={currency}
        categoryColors={categoryColors}
        onOptimisticAdd={(budget) => dispatch({ type: "add", budget })}
        onOptimisticUpdate={(id, patch) => dispatch({ type: "update", id, patch })}
        onOptimisticRemove={(id) => dispatch({ type: "remove", id })}
      />
    </>
  );
}
