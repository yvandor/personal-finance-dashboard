"use client";

import { useState } from "react";
import { Money } from "@/components/ui/Money";
import { GoalProgressRing } from "./GoalProgressRing";
import { GoalFormDialog } from "./GoalFormDialog";
import { ContributionFormDialog } from "./ContributionFormDialog";
import { DeleteGoalButton } from "./DeleteGoalButton";
import { ContributionHistoryList } from "./ContributionHistoryList";
import type { SavingsGoalProgressDTO, ContributionDTO } from "@/server/data/savingsGoals";

interface GoalCardProps {
  goal: SavingsGoalProgressDTO;
  contributions: ContributionDTO[];
  currency?: string;
}

function formatTargetDate(targetDate: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${targetDate}T00:00:00Z`),
  );
}

// Pace text carries the same meaning the ring's color/percentage does, in
// words -- same "never color-only" discipline as BudgetProgressBar.
function PaceHint({ goal }: { goal: SavingsGoalProgressDTO }) {
  if (goal.isAchieved) {
    return <p className="text-sm font-medium text-income">Goal reached</p>;
  }
  if (!goal.pace) {
    return null;
  }
  if (goal.pace.isOverdue) {
    return (
      <p className="text-sm font-medium text-danger">
        Overdue -- <Money cents={goal.pace.requiredPerMonthCents} className="font-medium" /> still needed
      </p>
    );
  }
  return (
    <p className="text-sm">
      <Money cents={goal.pace.requiredPerMonthCents} className="font-medium" />/month needed ·{" "}
      <span className={goal.pace.onTrack ? "text-income" : "text-amber-500"}>
        {goal.pace.onTrack ? "On track" : "Behind pace"}
      </span>
    </p>
  );
}

export function GoalCard({ goal, contributions, currency }: GoalCardProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{goal.name}</p>
          {goal.description && <p className="mt-0.5 text-sm text-muted">{goal.description}</p>}
          {goal.targetDate && (
            <p className="mt-0.5 text-sm text-muted">Target: {formatTargetDate(goal.targetDate)}</p>
          )}
        </div>
        <GoalProgressRing percentComplete={goal.percentComplete} isAchieved={goal.isAchieved} size={64} />
      </div>

      <p className="mt-3 text-sm text-muted">
        <Money cents={goal.currentCents} currency={currency} className="font-medium text-foreground" /> of{" "}
        <Money cents={goal.targetCents} currency={currency} />
      </p>

      <div className="mt-1">
        <PaceHint goal={goal} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!goal.isAchieved && (
          <ContributionFormDialog
            goalId={goal.id}
            triggerClassName="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            triggerAriaLabel={`Add contribution to ${goal.name}`}
          >
            Contribute
          </ContributionFormDialog>
        )}
        <GoalFormDialog
          mode="edit"
          goal={goal}
          triggerClassName="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-accent"
          triggerAriaLabel={`Edit ${goal.name}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </GoalFormDialog>
        <DeleteGoalButton id={goal.id} name={goal.name} />
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          className="ml-auto text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          {historyOpen ? "Hide history" : `History (${contributions.length})`}
        </button>
      </div>

      {historyOpen && (
        <div className="mt-3 border-t border-border pt-3">
          <ContributionHistoryList contributions={contributions} currency={currency} />
        </div>
      )}
    </div>
  );
}
