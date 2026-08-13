"use client";

import { useState } from "react";
import { Money } from "@/components/ui/Money";
import { GoalProgressRing } from "./GoalProgressRing";
import { GoalFormDialog } from "./GoalFormDialog";
import { ContributionFormDialog } from "./ContributionFormDialog";
import { DeleteGoalButton } from "./DeleteGoalButton";
import { ContributionHistoryList } from "./ContributionHistoryList";
import type { SavingsGoalProgressDTO, ContributionDTO } from "@/server/data/savingsGoals";

// Shared by every icon-only trigger on this card (edit here, delete inside
// DeleteGoalButton) -- same rounded-md chip + focus-visible ring as
// components/ui/Modal.tsx's close button, the frozen primitive this pattern
// is modeled on. Same shape as components/budgets/BudgetCard.tsx's
// ICON_BUTTON_CLASSES -- including its size-11 (44x44) thumb target; see
// that file for why the box is sized rather than padded.
const ICON_BUTTON_CLASSES =
  "inline-flex size-11 items-center justify-center rounded-md text-muted outline-none transition-colors hover:bg-surface-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface GoalCardProps {
  goal: SavingsGoalProgressDTO;
  contributions: ContributionDTO[];
  currency?: string;
  onOptimisticAdd?: (goal: SavingsGoalProgressDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<SavingsGoalProgressDTO>) => void;
  onOptimisticRemove?: (id: string) => void;
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

export function GoalCard({
  goal,
  contributions,
  currency,
  onOptimisticAdd,
  onOptimisticUpdate,
  onOptimisticRemove,
}: GoalCardProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{goal.name}</p>
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
            goal={goal}
            triggerClassName="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground outline-none transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            triggerAriaLabel={`Add contribution to ${goal.name}`}
            onOptimisticUpdate={onOptimisticUpdate}
          >
            Contribute
          </ContributionFormDialog>
        )}
        <GoalFormDialog
          mode="edit"
          goal={goal}
          triggerClassName={ICON_BUTTON_CLASSES}
          triggerAriaLabel={`Edit ${goal.name}`}
          onOptimisticUpdate={onOptimisticUpdate}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </GoalFormDialog>
        <DeleteGoalButton goal={goal} onOptimisticAdd={onOptimisticAdd} onOptimisticRemove={onOptimisticRemove} />
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          className="ml-auto rounded-md text-sm text-muted outline-none underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
