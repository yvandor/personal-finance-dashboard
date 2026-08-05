"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { BudgetForm } from "./BudgetForm";
import type { BudgetDTO } from "@/server/data/budgets";
import type { CategoryDTO } from "@/server/data/categories";

interface BudgetFormDialogProps {
  mode: "create" | "edit";
  budget?: BudgetDTO;
  categories?: CategoryDTO[];
  month: string;
  /** Rendered as the trigger button's content (text or an icon), not cloned. */
  children: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
}

// Same shape as TransactionFormDialog: owns its own trigger <button> (never
// clones a server-passed element -- see that component's comment for why),
// and remounts BudgetForm with a fresh key only when freshly opened, so a
// successful submission doesn't leave stale input behind for the next open
// while a failed submission's re-render keeps it.
export function BudgetFormDialog({
  mode,
  budget,
  categories,
  month,
  children,
  triggerClassName,
  triggerAriaLabel,
}: BudgetFormDialogProps) {
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
      <Modal open={open} onClose={() => setOpen(false)} title={mode === "create" ? "Add budget" : "Edit budget"}>
        <BudgetForm
          key={formInstanceKey}
          mode={mode}
          budget={budget}
          categories={categories}
          month={month}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
