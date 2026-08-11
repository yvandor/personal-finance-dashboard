"use client";

import { useState, useTransition } from "react";
import { deleteBudgetAction } from "@/server/actions/budgets";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import type { BudgetProgressDTO } from "@/server/data/budgets";

interface DeleteBudgetButtonProps {
  budget: BudgetProgressDTO;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticAdd?: (budget: BudgetProgressDTO) => void;
  onOptimisticRemove?: (id: string) => void;
  /** The undo window's length in ms. Defaults to 5000; overridable so tests don't need real 5-second waits. */
  undoWindowMs?: number;
}

// Same shape as DeleteTransactionButton: not useActionState, since this
// isn't a <form> and closing the dialog on success is an event-driven side
// effect of the confirm click.
//
// The confirm dialog and the undo toast are deliberately both present, not
// either/or -- docs/PROJECT_PLAN.md's Transactions AC calls for both
// ("confirmation required ... a short undo window is available"). Confirming
// closes the dialog and removes the row immediately (optimistic), then
// holds the real delete for the toast's duration: clicking Undo restores
// the row and the server is never called at all; letting the toast expire
// is what actually commits the delete. Both branches run inside the same
// startTransition -- useOptimistic requires the dispatch and the eventual
// settling to share one transition, or the row would flicker back before
// the undo window even closes.
export function DeleteBudgetButton({
  budget,
  onOptimisticAdd,
  onOptimisticRemove,
  undoWindowMs = 5000,
}: DeleteBudgetButtonProps) {
  const { id, categoryName } = budget;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast, showNotice } = useToast();

  function handleConfirm() {
    setError(null);
    setOpen(false);
    startTransition(async () => {
      onOptimisticRemove?.(id);
      const undone = await showToast({ message: `Deleted budget for "${categoryName}"`, duration: undoWindowMs });
      if (undone) {
        onOptimisticAdd?.(budget);
        return;
      }
      const result = await deleteBudgetAction(id, null);
      if (!result.ok) {
        onOptimisticAdd?.(budget);
        showNotice(`Couldn't delete the budget for "${categoryName}": ${result.error}`);
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
        aria-label={`Delete budget for ${categoryName}`}
        className="rounded-md p-2.5 text-muted hover:bg-danger/10 hover:text-danger"
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
        title="Delete budget?"
        description={`This will delete the budget for "${categoryName}". You'll have a few seconds to undo it afterward.`}
        pending={isPending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
