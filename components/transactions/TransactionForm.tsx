"use client";

import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createTransactionAction, updateTransactionAction } from "@/server/actions/transactions";
import { Button } from "@/components/ui/Button";
import { parseMoneyToCents } from "@/lib/money";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";
import type { ActionResult } from "@/lib/result";

interface TransactionFormProps {
  mode: "create" | "edit";
  transaction?: TransactionDTO;
  categories: CategoryDTO[];
  onSuccess: () => void;
  /**
   * Optional so every existing render/test call site keeps working
   * unchanged. Only passed by TransactionsBoard.tsx when the page is
   * showing the default (unfiltered, first-page) view -- see
   * lib/transactions.ts's comment on why an optimistic insert is skipped
   * everywhere else.
   */
  onOptimisticAdd?: (transaction: TransactionDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<TransactionDTO>) => void;
}

type FormState = ActionResult<TransactionDTO> | null;

// Every field is controlled by local state (value + onChange) rather than
// defaultValue. React's own handling of a native <form action={fn}> submit
// resets uncontrolled fields once the action settles, regardless of
// success or failure -- confirmed empirically, not just documentation --
// which would otherwise wipe a rejected submission's input right when the
// user most needs to see and fix it. Controlled inputs are immune to that
// reset because their displayed value always comes from React state, never
// from the DOM.
export function TransactionForm({
  mode,
  transaction,
  categories,
  onSuccess,
  onOptimisticAdd,
  onOptimisticUpdate,
}: TransactionFormProps) {
  const boundAction =
    mode === "edit" && transaction
      ? updateTransactionAction.bind(null, transaction.id)
      : createTransactionAction;

  // Wraps the real bound action so the optimistic dispatch happens inside
  // the same transition useActionState already runs its action in --
  // useOptimistic requires that. No derived fields to recompute here
  // (TransactionDTO is plain stored data, unlike Budget/Goal's server-
  // computed progress), so the draft is a direct merge of the form values.
  async function action(prevState: FormState, formData: FormData): Promise<FormState> {
    let amountCents = 0;
    try {
      amountCents = parseMoneyToCents(String(formData.get("amount") ?? ""));
    } catch {
      // fall through to the real action, which produces the field error
    }
    const draft = {
      type: formData.get("type") as "EXPENSE" | "INCOME",
      amountCents,
      date: String(formData.get("date") ?? ""),
      description: String(formData.get("description") ?? ""),
      notes: (formData.get("notes") as string) || null,
      categoryId: String(formData.get("categoryId") ?? ""),
    };
    if (mode === "create" && onOptimisticAdd) {
      const now = new Date().toISOString();
      onOptimisticAdd({
        id: `optimistic-${Date.now()}`,
        userId: "",
        ...draft,
        createdAt: now,
        updatedAt: now,
      });
    } else if (mode === "edit" && transaction && onOptimisticUpdate) {
      onOptimisticUpdate(transaction.id, draft);
    }
    return boundAction(prevState, formData);
  }

  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  const [type, setType] = useState<"EXPENSE" | "INCOME">(transaction?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(transaction ? (transaction.amountCents / 100).toFixed(2) : "");
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");

  // useActionState re-renders with the new state in the same round trip as
  // the submit, so this fires right after a successful create/update.
  useEffect(() => {
    if (state?.ok) {
      onSuccess();
    }
  }, [state, onSuccess]);

  // Belt-and-suspenders fix, verified empirically: after a native
  // <form action={fn}> submit settles (success or failure), something in
  // the browser/React's own form-action handling resets a <select>'s
  // selected option back to blank even though it's fully controlled --
  // text/textarea inputs correctly resist this, <select> does not. Forcing
  // the DOM property back to match state after every render, before paint,
  // keeps the category visibly correct regardless of what caused the
  // mismatch.
  const categorySelectRef = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    if (categorySelectRef.current && categorySelectRef.current.value !== categoryId) {
      categorySelectRef.current.value = categoryId;
    }
  });

  // Several TransactionForm instances (one per row's edit dialog, plus the
  // header's add dialog) are always mounted at once -- TransactionList
  // renders both the desktop table and mobile card list simultaneously,
  // each row wrapping its own edit dialog. A hardcoded id like "amount"
  // would duplicate across every instance, which breaks the label/
  // aria-describedby association for whichever instance isn't first in the
  // DOM. useId() gives each mounted form its own unique, stable prefix.
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

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
          aria-invalid={fieldErrors?.date ? true : undefined}
          aria-describedby={fieldErrors?.date ? fieldId("date-error") : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        {fieldErrors?.date && (
          <p id={fieldId("date-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.date[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("categoryId")} className="mb-1 block text-sm font-medium">
          Category
        </label>
        <select
          ref={categorySelectRef}
          id={fieldId("categoryId")}
          name="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          aria-invalid={fieldErrors?.categoryId ? true : undefined}
          aria-describedby={fieldErrors?.categoryId ? fieldId("category-error") : undefined}
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
          <p id={fieldId("category-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.categoryId[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("description")} className="mb-1 block text-sm font-medium">
          Description
        </label>
        <input
          id={fieldId("description")}
          name="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          required
          aria-invalid={fieldErrors?.description ? true : undefined}
          aria-describedby={fieldErrors?.description ? fieldId("description-error") : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
        {fieldErrors?.description && (
          <p id={fieldId("description-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.description[0]}
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
