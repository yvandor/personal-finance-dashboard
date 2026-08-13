"use client";

import { useState, useTransition } from "react";
import { archiveIncomeSourceAction, unarchiveIncomeSourceAction } from "@/server/actions/incomeSources";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import type { IncomeSourceManagementDTO } from "@/server/data/incomeSources";

interface ArchiveIncomeSourceButtonProps {
  id: string;
  name: string;
  isActive: boolean;
  transactionCount: number;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticUpdate?: (id: string, patch: Partial<IncomeSourceManagementDTO>) => void;
}

// Same shape as components/categories/ArchiveCategoryButton.tsx: archiving
// hides a source from every picker and the month's expected-vs-received
// breakdown, and gets a confirm step since it changes what's offered
// app-wide; unarchiving simply reverses that and needs no confirmation.
// No undo toast -- like Category, this is non-destructive and already
// reversible via reactivate, so a toast would be redundant.
export function ArchiveIncomeSourceButton({
  id,
  name,
  isActive,
  transactionCount,
  onOptimisticUpdate,
}: ArchiveIncomeSourceButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUnarchive() {
    setError(null);
    startTransition(async () => {
      onOptimisticUpdate?.(id, { isActive: true });
      const result = await unarchiveIncomeSourceAction(id, null);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  function handleArchiveConfirm() {
    setError(null);
    startTransition(async () => {
      onOptimisticUpdate?.(id, { isActive: false });
      const result = await archiveIncomeSourceAction(id, null);
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
          <path
            d="M3 4h18v4H3V4Zm2 4h14v12H5V8Zm4 4h6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ConfirmDialog
        open={open}
        title="Archive income source?"
        description={
          transactionCount > 0
            ? `"${name}" has ${transactionCount} tagged transaction${transactionCount === 1 ? "" : "s"}. Archiving hides it from new entries and future months' expected-vs-received breakdown, but keeps all existing history intact -- nothing is deleted.`
            : `"${name}" isn't currently in use. Archiving hides it from new entries; you can restore it anytime.`
        }
        confirmLabel="Archive"
        pending={isPending}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={handleArchiveConfirm}
      />
    </>
  );
}
