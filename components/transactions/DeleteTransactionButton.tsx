"use client";

import { useState, useTransition } from "react";
import { deleteTransactionAction } from "@/server/actions/transactions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface DeleteTransactionButtonProps {
  id: string;
  description: string;
  /** Compact icon-only trigger for table rows vs. a labeled button for mobile cards. */
  compact?: boolean;
}

// Deliberately not useActionState here: this isn't a <form>, and closing
// the dialog on success is an event-driven side effect of the confirm
// click, not something to derive via a useEffect watching action state.
export function DeleteTransactionButton({ id, description, compact = false }: DeleteTransactionButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteTransactionAction(id, null);
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
      {compact ? (
        <button
          type="button"
          onClick={openDialog}
          aria-label={`Delete ${description}`}
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
      ) : (
        <button
          type="button"
          onClick={openDialog}
          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/10"
        >
          Delete
        </button>
      )}
      <ConfirmDialog
        open={open}
        title="Delete transaction?"
        description={`This will permanently delete "${description}". This can't be undone.`}
        pending={isPending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
