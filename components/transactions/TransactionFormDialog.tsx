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
}

export function TransactionFormDialog({
  mode,
  transaction,
  categories,
  children,
  triggerClassName,
  triggerAriaLabel,
}: TransactionFormDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName} aria-label={triggerAriaLabel}>
        {children}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={mode === "create" ? "Add transaction" : "Edit transaction"}>
        <TransactionForm mode={mode} transaction={transaction} categories={categories} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
