"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { GoalForm } from "./GoalForm";
import type { SavingsGoalDTO } from "@/server/data/savingsGoals";

interface GoalFormDialogProps {
  mode: "create" | "edit";
  goal?: SavingsGoalDTO;
  children: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
}

// Same shape as BudgetFormDialog: owns its own trigger <button>, and
// remounts GoalForm with a fresh key only when freshly opened.
export function GoalFormDialog({ mode, goal, children, triggerClassName, triggerAriaLabel }: GoalFormDialogProps) {
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
      <Modal open={open} onClose={() => setOpen(false)} title={mode === "create" ? "Add goal" : "Edit goal"}>
        <GoalForm key={formInstanceKey} mode={mode} goal={goal} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}
