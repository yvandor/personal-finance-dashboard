"use client";

import { useState } from "react";
import { GoalCard } from "./GoalCard";
import type { SavingsGoalProgressDTO, ContributionDTO } from "@/server/data/savingsGoals";

interface GoalGridProps {
  goals: SavingsGoalProgressDTO[];
  contributionsByGoal: Map<string, ContributionDTO[]>;
  currency?: string;
  onOptimisticAdd?: (goal: SavingsGoalProgressDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<SavingsGoalProgressDTO>) => void;
  onOptimisticRemove?: (id: string) => void;
}

// Achieved goals move into a collapsed section rather than staying mixed in
// with active ones -- docs/PROJECT_PLAN.md's Savings Goals AC: "completed
// goals move to a collapsed/archived section."
export function GoalGrid({
  goals,
  contributionsByGoal,
  currency,
  onOptimisticAdd,
  onOptimisticUpdate,
  onOptimisticRemove,
}: GoalGridProps) {
  const [completedOpen, setCompletedOpen] = useState(false);

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-4 py-16 text-center">
        <p className="text-sm font-medium">No savings goals yet</p>
        <p className="text-sm text-muted">Add a goal to start tracking progress toward it.</p>
      </div>
    );
  }

  const active = goals.filter((g) => !g.isAchieved);
  const completed = goals.filter((g) => g.isAchieved);

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              contributions={contributionsByGoal.get(goal.id) ?? []}
              currency={currency}
              onOptimisticAdd={onOptimisticAdd}
              onOptimisticUpdate={onOptimisticUpdate}
              onOptimisticRemove={onOptimisticRemove}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setCompletedOpen((v) => !v)}
            aria-expanded={completedOpen}
            className="mb-2 rounded-md text-sm font-semibold text-muted outline-none transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Completed ({completed.length}) {completedOpen ? "▾" : "▸"}
          </button>
          {completedOpen && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  contributions={contributionsByGoal.get(goal.id) ?? []}
                  currency={currency}
                  onOptimisticAdd={onOptimisticAdd}
                  onOptimisticUpdate={onOptimisticUpdate}
                  onOptimisticRemove={onOptimisticRemove}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
