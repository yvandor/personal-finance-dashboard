"use client";

import { useState, useTransition } from "react";
import { deleteSavingsGoalAction } from "@/server/actions/savingsGoals";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import type { SavingsGoalProgressDTO } from "@/server/data/savingsGoals";

interface DeleteGoalButtonProps {
  goal: SavingsGoalProgressDTO;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticAdd?: (goal: SavingsGoalProgressDTO) => void;
  onOptimisticRemove?: (id: string) => void;
  /** The undo window's length in ms. Defaults to 5000; overridable so tests don't need real 5-second waits. */
  undoWindowMs?: number;
}

// Same shape as DeleteBudgetButton, including the confirm-dialog-plus-undo-toast
// pairing -- see that component's comment for why both stay, and why the
// optimistic dispatch and the eventual real delete share one transition.
// Unlike category archiving, deleting a goal is a real delete -- see
// server/data/savingsGoals.ts's comment on why that's safe here (a goal's
// contributions are their own self-contained ledger, never touching
// transactions). Undoing never touches the server at all, so the goal's
// contributions -- never actually deleted -- are simply there again the
// moment the goal itself reappears.
export function DeleteGoalButton({
  goal,
  onOptimisticAdd,
  onOptimisticRemove,
  undoWindowMs = 5000,
}: DeleteGoalButtonProps) {
  const { id, name } = goal;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast, showNotice } = useToast();

  function handleConfirm() {
    setError(null);
    setOpen(false);
    startTransition(async () => {
      onOptimisticRemove?.(id);
      const undone = await showToast({ message: `Deleted goal "${name}"`, duration: undoWindowMs });
      if (undone) {
        onOptimisticAdd?.(goal);
        return;
      }
      const result = await deleteSavingsGoalAction(id, null);
      if (!result.ok) {
        onOptimisticAdd?.(goal);
        showNotice(`Couldn't delete "${name}": ${result.error}`);
      }
    });
  }

  function openDialog() {
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label={`Delete goal ${name}`}
        className="rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ConfirmDialog
        open={open}
        title="Delete goal?"
        description={`This will delete "${name}" and its contribution history. You'll have a few seconds to undo it afterward.`}
        pending={isPending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
