"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createSavingsGoalAction, updateSavingsGoalAction } from "@/server/actions/savingsGoals";
import { Button } from "@/components/ui/Button";
import { computeGoalProgress, computeGoalPace } from "@/lib/savingsGoals";
import { parseMoneyToCents } from "@/lib/money";
import type { SavingsGoalDTO, SavingsGoalProgressDTO } from "@/server/data/savingsGoals";
import type { ActionResult } from "@/lib/result";

interface GoalFormProps {
  mode: "create" | "edit";
  /** SavingsGoalProgressDTO (not just SavingsGoalDTO) in edit mode so an
   * optimistic target/date change can recompute correct progress/pace. */
  goal?: SavingsGoalProgressDTO;
  onSuccess: () => void;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticAdd?: (goal: SavingsGoalProgressDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<SavingsGoalProgressDTO>) => void;
}

type FormState = ActionResult<SavingsGoalDTO> | null;

const DEFAULT_COLOR = "#0ea5e9";

// Controlled inputs from the start -- same reasoning as BudgetForm.tsx: a
// failed submission must never discard what was typed.
export function GoalForm({ mode, goal, onSuccess, onOptimisticAdd, onOptimisticUpdate }: GoalFormProps) {
  const boundAction = mode === "edit" && goal ? updateSavingsGoalAction.bind(null, goal.id) : createSavingsGoalAction;

  // Wraps the real bound action so the optimistic dispatch happens inside
  // the same transition useActionState already runs its action in --
  // useOptimistic requires that.
  async function action(prevState: FormState, formData: FormData): Promise<FormState> {
    let targetCents = 0;
    try {
      targetCents = parseMoneyToCents(String(formData.get("target") ?? ""));
    } catch {
      // fall through to the real action, which produces the field error
    }
    const name = String(formData.get("name") ?? "");
    const description = (formData.get("description") as string) || null;
    const targetDateRaw = formData.get("targetDate");
    const targetDate = targetDateRaw === "" ? null : ((targetDateRaw as string) ?? null);
    const color = String(formData.get("color") ?? DEFAULT_COLOR);

    if (mode === "create" && onOptimisticAdd) {
      const { remainingCents, percentComplete } = computeGoalProgress(targetCents, 0);
      const nowIso = new Date().toISOString();
      onOptimisticAdd({
        id: `optimistic-${Date.now()}`,
        name,
        description,
        targetCents,
        startingCents: 0,
        targetDate,
        status: "ACTIVE",
        color,
        achievedAt: null,
        createdAt: nowIso,
        currentCents: 0,
        remainingCents,
        percentComplete,
        isAchieved: false,
        pace:
          targetDate != null
            ? computeGoalPace({
                targetDate: new Date(`${targetDate}T00:00:00Z`),
                createdAt: new Date(nowIso),
                startingCents: 0,
                currentCents: 0,
                remainingCents,
              })
            : null,
      });
    } else if (mode === "edit" && goal && onOptimisticUpdate) {
      const { remainingCents, percentComplete } = computeGoalProgress(targetCents, goal.currentCents);
      const pace =
        !goal.isAchieved && targetDate != null
          ? computeGoalPace({
              targetDate: new Date(`${targetDate}T00:00:00Z`),
              createdAt: new Date(goal.createdAt),
              startingCents: goal.startingCents,
              currentCents: goal.currentCents,
              remainingCents,
            })
          : null;
      onOptimisticUpdate(goal.id, { name, description, targetCents, targetDate, color, remainingCents, percentComplete, pace });
    }
    return boundAction(prevState, formData);
  }

  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

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
          className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
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
          className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
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
          className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
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
          className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
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
            className="h-9 w-14 rounded-md border border-border-strong bg-background p-1"
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
