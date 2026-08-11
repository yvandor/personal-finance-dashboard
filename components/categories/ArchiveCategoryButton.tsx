"use client";

import { useState, useTransition } from "react";
import { archiveCategoryAction, unarchiveCategoryAction } from "@/server/actions/categories";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import type { CategoryManagementDTO } from "@/server/data/categories";

interface ArchiveCategoryButtonProps {
  id: string;
  name: string;
  isArchived: boolean;
  transactionCount: number;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticUpdate?: (id: string, patch: Partial<CategoryManagementDTO>) => void;
}

// Two very different-weight actions share this component because they're
// the two directions of the same toggle. Archiving hides a category from
// every picker and gets a confirm step (same ConfirmDialog pattern as
// DeleteBudgetButton) since it changes what's offered app-wide; unarchiving
// is simply reversing that and needs no confirmation.
export function ArchiveCategoryButton({
  id,
  name,
  isArchived,
  transactionCount,
  onOptimisticUpdate,
}: ArchiveCategoryButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUnarchive() {
    setError(null);
    startTransition(async () => {
      onOptimisticUpdate?.(id, { isArchived: false });
      const result = await unarchiveCategoryAction(id, null);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  function handleArchiveConfirm() {
    setError(null);
    startTransition(async () => {
      onOptimisticUpdate?.(id, { isArchived: true });
      const result = await archiveCategoryAction(id, null);
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (isArchived) {
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
        className="rounded-md p-2.5 text-muted hover:bg-danger/10 hover:text-danger"
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
        title="Archive category?"
        description={
          transactionCount > 0
            ? `"${name}" has ${transactionCount} transaction${transactionCount === 1 ? "" : "s"}. Archiving hides it from new entries but keeps all existing history intact -- nothing is deleted.`
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
