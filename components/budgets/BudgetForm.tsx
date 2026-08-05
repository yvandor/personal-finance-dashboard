"use client";

import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createBudgetAction, updateBudgetAction } from "@/server/actions/budgets";
import { Button } from "@/components/ui/Button";
import type { BudgetDTO } from "@/server/data/budgets";
import type { CategoryDTO } from "@/server/data/categories";
import type { ActionResult } from "@/lib/result";

interface BudgetFormProps {
  mode: "create" | "edit";
  budget?: BudgetDTO;
  /** Only used in create mode -- categories not yet budgeted for `month`. */
  categories?: CategoryDTO[];
  /** "YYYY-MM"; fixed for the lifetime of this form (not user-editable -- see budgetUpdateSchema's comment on why). */
  month: string;
  onSuccess: () => void;
}

type FormState = ActionResult<BudgetDTO> | null;

// Controlled inputs + useId() from the start, not retrofitted: a failed
// submission must never discard what was typed (a native <form
// action={fn}> resets uncontrolled fields once the action settles,
// regardless of success/failure -- see TransactionForm.tsx's comment for
// the full empirical story), and a grid of budget cards means many
// instances of this form's edit dialog are mounted simultaneously, so
// hardcoded ids would collide across them.
export function BudgetForm({ mode, budget, categories = [], month, onSuccess }: BudgetFormProps) {
  const boundAction =
    mode === "edit" && budget ? updateBudgetAction.bind(null, budget.id) : createBudgetAction;

  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, null);

  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? categories[0]?.id ?? "");
  const [amount, setAmount] = useState(budget ? (budget.amountCents / 100).toFixed(2) : "");
  const [notes, setNotes] = useState(budget?.notes ?? "");

  useEffect(() => {
    if (state?.ok) {
      onSuccess();
    }
  }, [state, onSuccess]);

  // Belt-and-suspenders fix for the same <select>-specific reset behavior
  // documented in TransactionForm.tsx.
  const categorySelectRef = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    if (categorySelectRef.current && categorySelectRef.current.value !== categoryId) {
      categorySelectRef.current.value = categoryId;
    }
  });

  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const generalError = state && !state.ok ? state.error : undefined;

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="month" value={month} />

      <div>
        <span className="mb-1 block text-sm font-medium">Month</span>
        <p className="text-sm text-muted">{monthLabel}</p>
      </div>

      <div>
        <label htmlFor={fieldId("categoryId")} className="mb-1 block text-sm font-medium">
          Category
        </label>
        {mode === "edit" && budget ? (
          <p className="text-sm">{budget.categoryName}</p>
        ) : (
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {categories.length === 0 && mode === "create" && (
          <p className="mt-1 text-sm text-muted">Every expense category already has a budget this month.</p>
        )}
        {fieldErrors?.categoryId && (
          <p id={fieldId("category-error")} role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.categoryId[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("amount")} className="mb-1 block text-sm font-medium">
          Monthly limit
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
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        />
      </div>

      {generalError && (
        <p role="alert" aria-live="polite" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {generalError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending || (mode === "create" && categories.length === 0)}>
          {pending ? "Saving…" : mode === "create" ? "Add budget" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
