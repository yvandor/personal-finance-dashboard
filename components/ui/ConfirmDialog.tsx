"use client";

import { useEffect, useRef } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  /** Shown inside the still-open dialog when a previous confirm attempt failed. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Focuses Cancel by default, not the destructive action — a stray Enter
// keypress should never trigger a delete.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Wait a tick for showModal() (triggered by Modal's own effect) to run first.
      const id = requestAnimationFrame(() => cancelRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-muted">{description}</p>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button ref={cancelRef} type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm} disabled={pending}>
          {pending ? "Deleting…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
