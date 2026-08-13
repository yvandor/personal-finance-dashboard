"use client";

import { useState, useTransition } from "react";
import { deleteTransactionAction } from "@/server/actions/transactions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import type { TransactionDTO } from "@/server/data/transactions";

interface DeleteTransactionButtonProps {
  transaction: TransactionDTO;
  /** Compact icon-only trigger for table rows vs. a labeled button for mobile cards. */
  compact?: boolean;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticAdd?: (transaction: TransactionDTO) => void;
  onOptimisticRemove?: (id: string) => void;
  /** The undo window's length in ms. Defaults to 5000; overridable so tests don't need real 5-second waits. */
  undoWindowMs?: number;
}

// Same shape as DeleteBudgetButton, including the confirm-dialog-plus-undo-toast
// pairing -- see that component's comment for why both stay, and why the
// optimistic dispatch and the eventual real delete share one transition.
// Deliberately not useActionState here: this isn't a <form>, and closing
// the dialog on success is an event-driven side effect of the confirm
// click, not something to derive via a useEffect watching action state.
export function DeleteTransactionButton({
  transaction,
  compact = false,
  onOptimisticAdd,
  onOptimisticRemove,
  undoWindowMs = 5000,
}: DeleteTransactionButtonProps) {
  const { id, description } = transaction;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast, showNotice } = useToast();

  function handleConfirm() {
    setError(null);
    setOpen(false);
    startTransition(async () => {
      onOptimisticRemove?.(id);
      const undone = await showToast({ message: `Deleted "${description}"`, duration: undoWindowMs });
      if (undone) {
        onOptimisticAdd?.(transaction);
        return;
      }
      const result = await deleteTransactionAction(id, null);
      if (!result.ok) {
        onOptimisticAdd?.(transaction);
        showNotice(`Couldn't delete "${description}": ${result.error}`);
      }
    });
  }

  function openDialog() {
    setError(null);
    setOpen(true);
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={openDialog}
          aria-label={`Delete ${description}`}
          className="inline-flex size-11 items-center justify-center rounded-md text-muted outline-none transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong px-4 text-sm font-medium text-danger outline-none transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Delete
        </button>
      )}
      <ConfirmDialog
        open={open}
        title="Delete transaction?"
        description={`This will delete "${description}". You'll have a few seconds to undo it afterward.`}
        pending={isPending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
