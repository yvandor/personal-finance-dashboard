"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { CategoryForm } from "./CategoryForm";
import type { CategoryDTO } from "@/server/data/categories";

interface CategoryFormDialogProps {
  mode: "create" | "edit";
  category?: CategoryDTO;
  children: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
}

// Same shape as BudgetFormDialog: owns its own trigger <button>, and
// remounts CategoryForm with a fresh key only when freshly opened.
export function CategoryFormDialog({
  mode,
  category,
  children,
  triggerClassName,
  triggerAriaLabel,
}: CategoryFormDialogProps) {
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
      <Modal open={open} onClose={() => setOpen(false)} title={mode === "create" ? "Add category" : "Edit category"}>
        <CategoryForm key={formInstanceKey} mode={mode} category={category} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
