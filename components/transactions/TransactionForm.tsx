"use client";

import { useActionState, useEffect, useState } from "react";
import { createTransactionAction, updateTransactionAction } from "@/server/actions/transactions";
import { Button } from "@/components/ui/Button";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";
import type { ActionResult } from "@/lib/result";

interface TransactionFormProps {
  mode: "create" | "edit";
  transaction?: TransactionDTO;
  categories: CategoryDTO[];
  onSuccess: () => void;
}

type FormState = ActionResult<TransactionDTO> | null;

export function TransactionForm({ mode, transaction, categories, onSuccess }: TransactionFormProps) {
  const [type, setType] = useState<"EXPENSE" | "INCOME">(transaction?.type ?? "EXPENSE");

  const boundAction =
    mode === "edit" && transaction
      ? updateTransactionAction.bind(null, transaction.id)
      : createTransactionAction;

  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, null);

  // useActionState re-renders with the new state in the same round trip as
  // the submit, so this fires right after a successful create/update.
  useEffect(() => {
    if (state?.ok) {
      onSuccess();
    }
  }, [state, onSuccess]);

  const initialAmount = transaction ? (transaction.amountCents / 100).toFixed(2) : "";
  const filteredCategories = categories.filter((c) => c.type === type);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const generalError = state && !state.ok ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <fieldset>
        <legend className="mb-1 block text-sm font-medium">Type</legend>
        <div className="flex gap-2">
          {(["EXPENSE", "INCOME"] as const).map((t) => (
            <label
              key={t}
              className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors ${
                type === t ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:bg-surface-hover"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="sr-only"
              />
              {t === "EXPENSE" ? "Expense" : "Income"}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="amount" className="mb-1 block text-sm font-medium">
          Amount
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          defaultValue={initialAmount}
          placeholder="0.00"
          required
          aria-invalid={fieldErrors?.amount ? true : undefined}
          aria-describedby={fieldErrors?.amount ? "amount-error" : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        {fieldErrors?.amount && (
          <p id="amount-error" role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.amount[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="date" className="mb-1 block text-sm font-medium">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={transaction?.date ?? new Date().toISOString().slice(0, 10)}
          required
          aria-invalid={fieldErrors?.date ? true : undefined}
          aria-describedby={fieldErrors?.date ? "date-error" : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        {fieldErrors?.date && (
          <p id="date-error" role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.date[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="categoryId" className="mb-1 block text-sm font-medium">
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={transaction?.categoryId ?? ""}
          required
          aria-invalid={fieldErrors?.categoryId ? true : undefined}
          aria-describedby={fieldErrors?.categoryId ? "category-error" : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        >
          <option value="" disabled>
            Select a category
          </option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {filteredCategories.length === 0 && (
          <p className="mt-1 text-sm text-muted">No {type.toLowerCase()} categories yet.</p>
        )}
        {fieldErrors?.categoryId && (
          <p id="category-error" role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.categoryId[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Description
        </label>
        <input
          id="description"
          name="description"
          type="text"
          defaultValue={transaction?.description ?? ""}
          maxLength={200}
          required
          aria-invalid={fieldErrors?.description ? true : undefined}
          aria-describedby={fieldErrors?.description ? "description-error" : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        {fieldErrors?.description && (
          <p id="description-error" role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.description[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">
          Notes <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={transaction?.notes ?? ""}
          maxLength={1000}
          rows={2}
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
          {pending ? "Saving…" : mode === "create" ? "Add transaction" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
