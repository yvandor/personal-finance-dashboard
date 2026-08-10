"use client";

import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { contributeToGoalAction } from "@/server/actions/savingsGoals";
import { Button } from "@/components/ui/Button";
import type { SavingsGoalProgressDTO } from "@/server/data/savingsGoals";
import type { ActionResult } from "@/lib/result";

interface ContributionFormProps {
  goalId: string;
  onSuccess: () => void;
}

type FormState = ActionResult<SavingsGoalProgressDTO> | null;

// Quick-add amount chips, per docs/PROJECT_PLAN.md's key interaction flows
// ("contribution sheet with quick-add amount chips"). Whole dollars only --
// deliberately round numbers, not derived from the goal's own remaining
// balance, so they stay simple, predictable buttons rather than a
// pace-driven suggestion this component would need to compute itself.
const QUICK_AMOUNTS = ["25", "50", "100", "250"];

// Controlled inputs throughout, same reasoning as every other form in this
// app. The direction radio group needs the same belt-and-suspenders DOM-sync
// fix CategoryForm.tsx's type radios needed -- verified empirically to
// affect a controlled radio group the same way TransactionForm/BudgetForm's
// <select> comment documents.
export function ContributionForm({ goalId, onSuccess }: ContributionFormProps) {
  const boundAction = contributeToGoalAction.bind(null, goalId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, null);

  const [direction, setDirection] = useState<"CONTRIBUTION" | "WITHDRAWAL">("CONTRIBUTION");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  useEffect(() => {
    if (state?.ok) {
      onSuccess();
    }
  }, [state, onSuccess]);

  const contributionRadioRef = useRef<HTMLInputElement>(null);
  const withdrawalRadioRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (contributionRadioRef.current) contributionRadioRef.current.checked = direction === "CONTRIBUTION";
    if (withdrawalRadioRef.current) withdrawalRadioRef.current.checked = direction === "WITHDRAWAL";
  });

  const uid = useId();
  const fieldId = (field: string) => `${uid}-${field}`;

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const generalError = state && !state.ok ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <span className="mb-1 block text-sm font-medium">Type</span>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              ref={contributionRadioRef}
              type="radio"
              name="direction"
              value="CONTRIBUTION"
              checked={direction === "CONTRIBUTION"}
              onChange={() => setDirection("CONTRIBUTION")}
            />
            Contribution
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              ref={withdrawalRadioRef}
              type="radio"
              name="direction"
              value="WITHDRAWAL"
              checked={direction === "WITHDRAWAL"}
              onChange={() => setDirection("WITHDRAWAL")}
            />
            Withdrawal
          </label>
        </div>
      </div>

      <div>
        <label htmlFor={fieldId("amount")} className="mb-1 block text-sm font-medium">
          Amount
        </label>
        <input
          id={fieldId("amount")}
          name="amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
          aria-invalid={fieldErrors?.amount ? true : undefined}
          aria-describedby={fieldErrors?.amount ? fieldId("amount-error") : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(v)}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-surface-hover"
            >
              ${v}
            </button>
          ))}
        </div>
        {fieldErrors?.amount && (
          <p id={fieldId("amount-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.amount[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("date")} className="mb-1 block text-sm font-medium">
          Date
        </label>
        <input
          id={fieldId("date")}
          name="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor={fieldId("note")} className="mb-1 block text-sm font-medium">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id={fieldId("note")}
          name="note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
      </div>

      {generalError && (
        <p role="alert" aria-live="polite" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {generalError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : direction === "CONTRIBUTION" ? "Add contribution" : "Record withdrawal"}
        </Button>
      </div>
    </form>
  );
}
