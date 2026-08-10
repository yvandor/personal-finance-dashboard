"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { TransactionForm } from "./TransactionForm";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";

interface TransactionFormDialogProps {
  mode: "create" | "edit";
  transaction?: TransactionDTO;
  categories: CategoryDTO[];
  /** Rendered as the trigger button's content (text or an icon), not cloned. */
  children: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  onOptimisticAdd?: (transaction: TransactionDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<TransactionDTO>) => void;
}

export function TransactionFormDialog({
  mode,
  transaction,
  categories,
  children,
  triggerClassName,
  triggerAriaLabel,
  onOptimisticAdd,
  onOptimisticUpdate,
}: TransactionFormDialogProps) {
  const [open, setOpen] = useState(false);

  // Modal always renders TransactionForm (open only toggles CSS visibility
  // via the native <dialog>), so the form's local state would otherwise
  // survive across opens -- a successful "Add transaction" would leave the
  // next fresh "Add" pre-filled with whatever was last typed. Incrementing
  // this key each time the dialog is freshly opened forces a new
  // TransactionForm instance (fresh field state) at that point, while a
  // re-render from a failed submission -- which doesn't call this handler
  // -- leaves the key, and the user's entered values, untouched.
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
      <Modal open={open} onClose={() => setOpen(false)} title={mode === "create" ? "Add transaction" : "Edit transaction"}>
        <TransactionForm
          key={formInstanceKey}
          mode={mode}
          transaction={transaction}
          categories={categories}
          onSuccess={() => setOpen(false)}
          onOptimisticAdd={onOptimisticAdd}
          onOptimisticUpdate={onOptimisticUpdate}
        />
      </Modal>
    </>
  );
}
