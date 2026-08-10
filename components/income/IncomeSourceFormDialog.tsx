"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { IncomeSourceForm } from "./IncomeSourceForm";
import type { IncomeSourceManagementDTO } from "@/server/data/incomeSources";

interface IncomeSourceFormDialogProps {
  mode: "create" | "edit";
  incomeSource?: IncomeSourceManagementDTO;
  children: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  onOptimisticAdd?: (incomeSource: IncomeSourceManagementDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<IncomeSourceManagementDTO>) => void;
}

// Same shape as components/categories/CategoryFormDialog.tsx: owns its own
// trigger <button>, and remounts IncomeSourceForm with a fresh key only
// when freshly opened.
export function IncomeSourceFormDialog({
  mode,
  incomeSource,
  children,
  triggerClassName,
  triggerAriaLabel,
  onOptimisticAdd,
  onOptimisticUpdate,
}: IncomeSourceFormDialogProps) {
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
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "create" ? "Add income source" : "Edit income source"}
      >
        <IncomeSourceForm
          key={formInstanceKey}
          mode={mode}
          incomeSource={incomeSource}
          onSuccess={() => setOpen(false)}
          onOptimisticAdd={onOptimisticAdd}
          onOptimisticUpdate={onOptimisticUpdate}
        />
      </Modal>
    </>
  );
}
