"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createSavingsGoalAction, updateSavingsGoalAction } from "@/server/actions/savingsGoals";
import { Button } from "@/components/ui/Button";
import type { SavingsGoalDTO } from "@/server/data/savingsGoals";
import type { ActionResult } from "@/lib/result";

interface GoalFormProps {
  mode: "create" | "edit";
  goal?: SavingsGoalDTO;
  onSuccess: () => void;
}

type FormState = ActionResult<SavingsGoalDTO> | null;

const DEFAULT_COLOR = "#0ea5e9";

// Controlled inputs from the start -- same reasoning as BudgetForm.tsx: a
// failed submission must never discard what was typed.
export function GoalForm({ mode, goal, onSuccess }: GoalFormProps) {
  const boundAction = mode === "edit" && goal ? updateSavingsGoalAction.bind(null, goal.id) : createSavingsGoalAction;

  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, null);

  const [name, setName] = useState(goal?.name ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [target, setTarget] = useState(goal ? (goal.targetCents / 100).toFixed(2) : "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [color, setColor] = useState(goal?.color ?? DEFAULT_COLOR);

  useEffect(() => {
    if (state?.ok) {
      onSuccess();
    }
  }, [state, onSuccess]);

  const uid = useId();
  const fieldId = (field: string) => `${uid}-${field}`;

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const generalError = state && !state.ok ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <label htmlFor={fieldId("name")} className="mb-1 block text-sm font-medium">
          Name
        </label>
        <input
          id={fieldId("name")}
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          aria-invalid={fieldErrors?.name ? true : undefined}
          aria-describedby={fieldErrors?.name ? fieldId("name-error") : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        {fieldErrors?.name && (
          <p id={fieldId("name-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.name[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("description")} className="mb-1 block text-sm font-medium">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={fieldId("description")}
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor={fieldId("target")} className="mb-1 block text-sm font-medium">
          Target amount
        </label>
        <input
          id={fieldId("target")}
          name="target"
          type="text"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="0.00"
          required
          aria-invalid={fieldErrors?.target ? true : undefined}
          aria-describedby={fieldErrors?.target ? fieldId("target-error") : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        {fieldErrors?.target && (
          <p id={fieldId("target-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.target[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("targetDate")} className="mb-1 block text-sm font-medium">
          Target date <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id={fieldId("targetDate")}
          name="targetDate"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          aria-invalid={fieldErrors?.targetDate ? true : undefined}
          aria-describedby={fieldErrors?.targetDate ? fieldId("targetDate-error") : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        {fieldErrors?.targetDate && (
          <p id={fieldId("targetDate-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.targetDate[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("color")} className="mb-1 block text-sm font-medium">
          Color
        </label>
        <div className="flex items-center gap-3">
          <input
            id={fieldId("color")}
            name="color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-14 rounded-md border border-border bg-background p-1"
          />
          <span className="text-sm text-muted">{color}</span>
        </div>
      </div>

      {generalError && (
        <p role="alert" aria-live="polite" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {generalError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add goal" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
