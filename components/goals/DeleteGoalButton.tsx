"use client";

import { useState, useTransition } from "react";
import { deleteSavingsGoalAction } from "@/server/actions/savingsGoals";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface DeleteGoalButtonProps {
  id: string;
  name: string;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticRemove?: (id: string) => void;
}

// Same shape as DeleteBudgetButton. Unlike category archiving, deleting a
// goal is a real delete -- see server/data/savingsGoals.ts's comment on why
// that's safe here (a goal's contributions are their own self-contained
// ledger, never touching transactions).
export function DeleteGoalButton({ id, name, onOptimisticRemove }: DeleteGoalButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      onOptimisticRemove?.(id);
      const result = await deleteSavingsGoalAction(id, null);
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
        description={`This will permanently delete "${name}" and its contribution history. This can't be undone.`}
        pending={isPending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
