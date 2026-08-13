"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createIncomeSourceAction, updateIncomeSourceAction } from "@/server/actions/incomeSources";
import { Button } from "@/components/ui/Button";
import { parseMoneyToCents } from "@/lib/money";
import type { IncomeSourceDTO, IncomeSourceManagementDTO } from "@/server/data/incomeSources";
import type { ActionResult } from "@/lib/result";

interface IncomeSourceFormProps {
  mode: "create" | "edit";
  incomeSource?: IncomeSourceManagementDTO;
  onSuccess: () => void;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticAdd?: (incomeSource: IncomeSourceManagementDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<IncomeSourceManagementDTO>) => void;
}

type FormState = ActionResult<IncomeSourceDTO> | null;

// Controlled inputs from the start -- same reasoning as CategoryForm.tsx: a
// failed submission must never discard what was typed, and one instance of
// this form's edit dialog is mounted per row.
export function IncomeSourceForm({ mode, incomeSource, onSuccess, onOptimisticAdd, onOptimisticUpdate }: IncomeSourceFormProps) {
  const boundAction =
    mode === "edit" && incomeSource ? updateIncomeSourceAction.bind(null, incomeSource.id) : createIncomeSourceAction;

  // Wraps the real bound action so the optimistic dispatch happens inside
  // the same transition useActionState already runs its action in --
  // useOptimistic requires that. isActive/transactionCount default to
  // true/0 for a brand-new source -- always exactly correct, since it can't
  // be archived or have any tagged transactions yet.
  async function action(prevState: FormState, formData: FormData): Promise<FormState> {
    let amountCents = 0;
    try {
      amountCents = parseMoneyToCents(String(formData.get("amount") ?? ""));
    } catch {
      // fall through to the real action, which produces the field error
    }
    const payDay = Number(formData.get("payDay") ?? 0);
    const name = String(formData.get("name") ?? "");
    const notes = (formData.get("notes") as string) || null;

    if (mode === "create" && onOptimisticAdd) {
      onOptimisticAdd({
        id: `optimistic-${Date.now()}`,
        name,
        amountCents,
        payDay,
        notes,
        isActive: true,
        transactionCount: 0,
      });
    } else if (mode === "edit" && incomeSource && onOptimisticUpdate) {
      onOptimisticUpdate(incomeSource.id, { name, amountCents, payDay, notes });
    }
    return boundAction(prevState, formData);
  }

  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  const [name, setName] = useState(incomeSource?.name ?? "");
  const [amount, setAmount] = useState(incomeSource ? (incomeSource.amountCents / 100).toFixed(2) : "");
  const [payDay, setPayDay] = useState(incomeSource ? String(incomeSource.payDay) : "1");
  const [notes, setNotes] = useState(incomeSource?.notes ?? "");

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
        <label htmlFor={fieldId("amount")} className="mb-1 block text-sm font-medium">
          Expected amount
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
          className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        {fieldErrors?.amount && (
          <p id={fieldId("amount-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.amount[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("payDay")} className="mb-1 block text-sm font-medium">
          Pay day
        </label>
        <input
          id={fieldId("payDay")}
          name="payDay"
          type="number"
          min={1}
          max={31}
          step={1}
          value={payDay}
          onChange={(e) => setPayDay(e.target.value)}
          required
          aria-invalid={fieldErrors?.payDay ? true : undefined}
          aria-describedby={fieldErrors?.payDay ? fieldId("payDay-error") : undefined}
          className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-sm text-muted">
          Day of the month this is expected. A value of 31 means the last day of any shorter month.
        </p>
        {fieldErrors?.payDay && (
          <p id={fieldId("payDay-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.payDay[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("notes")} className="mb-1 block text-sm font-medium">
          Notes <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={fieldId("notes")}
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
      </div>

      {generalError && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {generalError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add income source" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
