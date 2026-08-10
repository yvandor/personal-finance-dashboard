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
  month: string;
  currency?: string;
}

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90";

// Owns the useOptimistic overlay so the header's "Add budget" trigger and
// the list below it share one optimistic array (see lib/budgets.ts's
// budgetOptimisticReducer for the three actions this supports). Both need
// to be inside the SAME client component for that sharing to work, which is
// why this now owns the header row too, not just app/(dashboard)/budgets/page.tsx.
// When `budgets` changes (e.g. navigating to a different month via
// MonthSelector), useOptimistic resets to that new base automatically --
// no stale optimistic row can leak across a month change.
export function BudgetsBoard({ budgets, availableCategories, month, currency }: BudgetsBoardProps) {
  const [optimisticBudgets, dispatch] = useOptimistic(budgets, budgetOptimisticReducer);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Budgets</h1>
          <p className="text-sm text-muted">Set monthly limits per category and track spending against them.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector month={month} />
          <CopyLastMonthBudgetsButton
            month={month}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover disabled:opacity-60"
          />
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
        onOptimisticAdd={(budget) => dispatch({ type: "add", budget })}
        onOptimisticUpdate={(id, patch) => dispatch({ type: "update", id, patch })}
        onOptimisticRemove={(id) => dispatch({ type: "remove", id })}
      />
    </>
  );
}
