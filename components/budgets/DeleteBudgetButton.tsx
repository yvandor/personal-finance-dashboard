"use client";

import { useState, useTransition } from "react";
import { deleteBudgetAction } from "@/server/actions/budgets";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface DeleteBudgetButtonProps {
  id: string;
  categoryName: string;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticRemove?: (id: string) => void;
}

// Same shape as DeleteTransactionButton: not useActionState, since this
// isn't a <form> and closing the dialog on success is an event-driven side
// effect of the confirm click.
export function DeleteBudgetButton({ id, categoryName, onOptimisticRemove }: DeleteBudgetButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      // Dispatched inside this same transition, before the await -- the
      // row disappears from the list immediately; useOptimistic reverts it
      // automatically (the row reappears) once this transition settles, if
      // the real delete below turns out to have failed.
      onOptimisticRemove?.(id);
      const result = await deleteBudgetAction(id, null);
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.error);
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
        title="Delete budget?"
        description={`This will permanently delete the budget for "${categoryName}". This can't be undone.`}
        pending={isPending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
