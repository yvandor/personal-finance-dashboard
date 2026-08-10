"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { ContributionForm } from "./ContributionForm";

interface ContributionFormDialogProps {
  goalId: string;
  children: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
}

export function ContributionFormDialog({ goalId, children, triggerClassName, triggerAriaLabel }: ContributionFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [formInstanceKey, setFormInstanceKey] = useState(0);

  function openDialog() {
    setFormInstanceKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={openDialog} className={triggerClassName} aria-label={triggerAriaLabel}>
        {children}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add contribution">
        <ContributionForm key={formInstanceKey} goalId={goalId} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
