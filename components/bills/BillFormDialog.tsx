"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { BillForm } from "./BillForm";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";
import type { CategoryDTO } from "@/server/data/categories";

interface BillFormDialogProps {
  mode: "create" | "edit";
  bill?: RecurringBillWithStatusDTO;
  categories?: CategoryDTO[];
  children: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  onOptimisticAdd?: (bill: RecurringBillWithStatusDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<RecurringBillWithStatusDTO>) => void;
}

// Same shape as CategoryFormDialog/BudgetFormDialog: owns its own trigger
// <button>, and remounts BillForm with a fresh key only when freshly opened.
export function BillFormDialog({
  mode,
  bill,
  categories,
  children,
  triggerClassName,
  triggerAriaLabel,
  onOptimisticAdd,
  onOptimisticUpdate,
}: BillFormDialogProps) {
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
      <Modal open={open} onClose={() => setOpen(false)} title={mode === "create" ? "Add bill" : "Edit bill"}>
        <BillForm
          key={formInstanceKey}
          mode={mode}
          bill={bill}
          categories={categories}
          onSuccess={() => setOpen(false)}
          onOptimisticAdd={onOptimisticAdd}
          onOptimisticUpdate={onOptimisticUpdate}
        />
      </Modal>
    </>
  );
}
