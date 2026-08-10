"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { MarkBillPaidForm } from "./MarkBillPaidForm";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";

interface MarkBillPaidDialogProps {
  bill: RecurringBillWithStatusDTO;
  periodMonth: string;
  currency?: string;
  children: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
}

export function MarkBillPaidDialog({
  bill,
  periodMonth,
  currency,
  children,
  triggerClassName,
  triggerAriaLabel,
}: MarkBillPaidDialogProps) {
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
      <Modal open={open} onClose={() => setOpen(false)} title="Mark bill paid">
        <MarkBillPaidForm
          key={formInstanceKey}
          bill={bill}
          periodMonth={periodMonth}
          currency={currency}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
