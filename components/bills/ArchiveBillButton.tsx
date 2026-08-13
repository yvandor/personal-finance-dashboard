"use client";

import { useState, useTransition } from "react";
import { archiveRecurringBillAction, unarchiveRecurringBillAction } from "@/server/actions/recurringBills";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";

interface ArchiveBillButtonProps {
  id: string;
  name: string;
  isActive: boolean;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticUpdate?: (id: string, patch: Partial<RecurringBillWithStatusDTO>) => void;
}

// Same shape as ArchiveCategoryButton: two very different-weight actions
// share this component because they're the two directions of the same
// toggle. Archiving stops a bill appearing as a reminder and gets a confirm
// step (it changes what's offered); unarchiving just reverses that and
// needs no confirmation.
export function ArchiveBillButton({ id, name, isActive, onOptimisticUpdate }: ArchiveBillButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUnarchive() {
    setError(null);
    startTransition(async () => {
      onOptimisticUpdate?.(id, { isActive: true });
      const result = await unarchiveRecurringBillAction(id, null);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  function handleArchiveConfirm() {
    setError(null);
    startTransition(async () => {
      onOptimisticUpdate?.(id, { isActive: false });
      const result = await archiveRecurringBillAction(id, null);
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (!isActive) {
    return (
      <>
        <Button type="button" variant="secondary" onClick={handleUnarchive} disabled={isPending}>
          {isPending ? "Restoring…" : "Restore"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={`Archive ${name}`}
        className="rounded-md p-2.5 text-muted outline-none transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 4h18v4H3V4Zm2 4h14v12H5V8Zm4 4h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <ConfirmDialog
        open={open}
        title="Archive bill?"
        description={`"${name}" will stop appearing as a reminder. Its payment history is kept, and you can restore it anytime.`}
        confirmLabel="Archive"
        pending={isPending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={handleArchiveConfirm}
      />
    </>
  );
}
