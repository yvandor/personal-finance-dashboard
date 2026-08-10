"use client";

import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createCategoryAction, updateCategoryAction } from "@/server/actions/categories";
import { Button } from "@/components/ui/Button";
import type { CategoryDTO } from "@/server/data/categories";
import type { ActionResult } from "@/lib/result";

interface CategoryFormProps {
  mode: "create" | "edit";
  category?: CategoryDTO;
  onSuccess: () => void;
}

type FormState = ActionResult<CategoryDTO> | null;

const DEFAULT_COLOR = "#64748b";

// Controlled inputs from the start -- same reasoning as BudgetForm.tsx: a
// failed submission must never discard what was typed, and many instances
// of this form's edit dialog can be mounted at once (one per row).
export function CategoryForm({ mode, category, onSuccess }: CategoryFormProps) {
  const boundAction =
    mode === "edit" && category ? updateCategoryAction.bind(null, category.id) : createCategoryAction;

  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, null);

  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<"INCOME" | "EXPENSE">(category?.type ?? "EXPENSE");
  const [color, setColor] = useState(category?.color ?? DEFAULT_COLOR);

  useEffect(() => {
    if (state?.ok) {
      onSuccess();
    }
  }, [state, onSuccess]);

  // Belt-and-suspenders fix for the same post-action DOM-reset quirk
  // documented in TransactionForm.tsx/BudgetForm.tsx for <select> --
  // verified empirically to affect a controlled radio group too: after the
  // native <form action={fn}> submit settles, the DOM's `checked` state can
  // desync from React's `checked` prop. Forcing it back after every render,
  // before paint, keeps the selected type visibly correct regardless of
  // cause.
  const expenseRadioRef = useRef<HTMLInputElement>(null);
  const incomeRadioRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (expenseRadioRef.current) expenseRadioRef.current.checked = type === "EXPENSE";
    if (incomeRadioRef.current) incomeRadioRef.current.checked = type === "INCOME";
  });

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
          maxLength={60}
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
        <span className="mb-1 block text-sm font-medium">Type</span>
        {mode === "edit" ? (
          <p className="text-sm text-muted">
            {type === "INCOME" ? "Income" : "Expense"} (can&apos;t be changed after creation)
          </p>
        ) : (
          <div className="flex gap-4">
            {(["EXPENSE", "INCOME"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  ref={t === "EXPENSE" ? expenseRadioRef : incomeRadioRef}
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                />
                {t === "INCOME" ? "Income" : "Expense"}
              </label>
            ))}
          </div>
        )}
        {mode === "edit" && <input type="hidden" name="type" value={type} />}
        {fieldErrors?.type && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.type[0]}
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
        {fieldErrors?.color && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.color[0]}
          </p>
        )}
      </div>

      {generalError && (
        <p role="alert" aria-live="polite" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {generalError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add category" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
