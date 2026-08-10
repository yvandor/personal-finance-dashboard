"use client";

import { useOptimistic } from "react";
import { goalOptimisticReducer } from "@/lib/savingsGoals";
import { GoalFormDialog } from "./GoalFormDialog";
import { GoalGrid } from "./GoalGrid";
import type { SavingsGoalProgressDTO, ContributionDTO } from "@/server/data/savingsGoals";

interface GoalsBoardProps {
  goals: SavingsGoalProgressDTO[];
  contributionsByGoal: Map<string, ContributionDTO[]>;
  currency?: string;
}

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90";

// Owns the useOptimistic overlay so the header's "Add goal" trigger and the
// grid below it share one optimistic array -- same shape as
// components/budgets/BudgetsBoard.tsx.
export function GoalsBoard({ goals, contributionsByGoal, currency }: GoalsBoardProps) {
  const [optimisticGoals, dispatch] = useOptimistic(goals, goalOptimisticReducer);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Savings Goals</h1>
          <p className="text-sm text-muted">
            Track progress toward a target. Contributions are independent of your transaction ledger.
          </p>
        </div>
        <GoalFormDialog
          mode="create"
          triggerClassName={PRIMARY_BUTTON_CLASSES}
          onOptimisticAdd={(goal) => dispatch({ type: "add", goal })}
        >
          Add goal
        </GoalFormDialog>
      </div>

      <GoalGrid
        goals={optimisticGoals}
        contributionsByGoal={contributionsByGoal}
        currency={currency}
        onOptimisticUpdate={(id, patch) => dispatch({ type: "update", id, patch })}
        onOptimisticRemove={(id) => dispatch({ type: "remove", id })}
      />
    </>
  );
}
