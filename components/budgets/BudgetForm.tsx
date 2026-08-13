"use client";

import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createBudgetAction, updateBudgetAction } from "@/server/actions/budgets";
import { Button } from "@/components/ui/Button";
import { computeBudgetProgress } from "@/lib/budgets";
import { parseMoneyToCents } from "@/lib/money";
import type { BudgetDTO, BudgetProgressDTO } from "@/server/data/budgets";
import type { CategoryDTO } from "@/server/data/categories";
import type { ActionResult } from "@/lib/result";

interface BudgetFormProps {
  mode: "create" | "edit";
  /** BudgetProgressDTO (not just BudgetDTO) in edit mode so an optimistic
   * amount change can recompute correct progress from the existing spentCents. */
  budget?: BudgetProgressDTO;
  /** Only used in create mode -- categories not yet budgeted for `month`. */
  categories?: CategoryDTO[];
  /** "YYYY-MM"; fixed for the lifetime of this form (not user-editable -- see budgetUpdateSchema's comment on why). */
  month: string;
  onSuccess: () => void;
  /**
   * Optional so every existing render/test call site keeps working
   * unchanged. When provided (by BudgetsBoard.tsx), the row appears/updates
   * in the list immediately, before the server round trip completes --
   * spentCents defaults to 0 for a brand-new budget (this client has no way
   * to know this month's existing spend for that category without an extra
   * fetch), self-correcting to the real value within the round trip;
   * amountCents changes on an *existing* budget recompute the full,
   * correct progress via the same computeBudgetProgress the DAL uses,
   * since spentCents is already known.
   */
  onOptimisticAdd?: (budget: BudgetProgressDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<BudgetProgressDTO>) => void;
}

type FormState = ActionResult<BudgetDTO> | null;

// Controlled inputs + useId() from the start, not retrofitted: a failed
// submission must never discard what was typed (a native <form
// action={fn}> resets uncontrolled fields once the action settles,
// regardless of success/failure -- see TransactionForm.tsx's comment for
// the full empirical story), and a grid of budget cards means many
// instances of this form's edit dialog are mounted simultaneously, so
// hardcoded ids would collide across them.
export function BudgetForm({
  mode,
  budget,
  categories = [],
  month,
  onSuccess,
  onOptimisticAdd,
  onOptimisticUpdate,
}: BudgetFormProps) {
  const boundAction =
    mode === "edit" && budget ? updateBudgetAction.bind(null, budget.id) : createBudgetAction;

  // Wraps the real bound action so the optimistic dispatch happens inside
  // the same transition useActionState already runs its action in --
  // useOptimistic requires that. A parse failure here (invalid amount)
  // still dispatches the optimistic update with amountCents left
  // unparsed/0 -- harmless, since the real action below will reject it
  // with a field error and the optimistic overlay reverts once this
  // transition settles.
  async function action(prevState: FormState, formData: FormData): Promise<FormState> {
    let amountCents = 0;
    try {
      amountCents = parseMoneyToCents(String(formData.get("amount") ?? ""));
    } catch {
      // fall through to the real action, which produces the field error
    }
    if (mode === "create" && onOptimisticAdd) {
      const categoryId = String(formData.get("categoryId") ?? "");
      const category = categories.find((c) => c.id === categoryId);
      const progress = computeBudgetProgress(amountCents, 0);
      onOptimisticAdd({
        id: `optimistic-${Date.now()}`,
        categoryId,
        categoryName: category?.name ?? "",
        month,
        amountCents,
        notes: (formData.get("notes") as string) || null,
        spentCents: 0,
        ...progress,
      });
    } else if (mode === "edit" && budget && onOptimisticUpdate) {
      onOptimisticUpdate(budget.id, {
        amountCents,
        notes: (formData.get("notes") as string) || null,
        ...computeBudgetProgress(amountCents, budget.spentCents),
      });
    }
    return boundAction(prevState, formData);
  }

  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

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
            className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
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
          className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
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
          className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
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
