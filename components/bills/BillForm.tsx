"use client";

import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createRecurringBillAction, updateRecurringBillAction } from "@/server/actions/recurringBills";
import { Button } from "@/components/ui/Button";
import { computeBillStatus } from "@/lib/recurringBills";
import { parseMoneyToCents } from "@/lib/money";
import type { RecurringBillDTO, RecurringBillWithStatusDTO } from "@/server/data/recurringBills";
import type { CategoryDTO } from "@/server/data/categories";
import type { ActionResult } from "@/lib/result";

interface BillFormProps {
  mode: "create" | "edit";
  bill?: RecurringBillWithStatusDTO;
  /** EXPENSE categories only -- see app/(dashboard)/bills/page.tsx. */
  categories?: CategoryDTO[];
  onSuccess: () => void;
  /** Optional so every existing render/test call site keeps working unchanged. */
  onOptimisticAdd?: (bill: RecurringBillWithStatusDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<RecurringBillWithStatusDTO>) => void;
}

type FormState = ActionResult<RecurringBillDTO> | null;

const DUE_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Controlled inputs from the start -- same reasoning as CategoryForm.tsx: a
// failed submission must never discard what was typed, and one edit dialog
// per row means many instances can be mounted at once.
export function BillForm({ mode, bill, categories = [], onSuccess, onOptimisticAdd, onOptimisticUpdate }: BillFormProps) {
  const boundAction = mode === "edit" && bill ? updateRecurringBillAction.bind(null, bill.id) : createRecurringBillAction;

  // Wraps the real bound action so the optimistic dispatch happens inside
  // the same transition useActionState already runs its action in --
  // useOptimistic requires that. Reuses computeBillStatus (the exact same
  // pure math the DAL uses) so the optimistic status/dueDate is the real
  // result, not an approximation.
  async function action(prevState: FormState, formData: FormData): Promise<FormState> {
    let amountCents = 0;
    try {
      amountCents = parseMoneyToCents(String(formData.get("amount") ?? ""));
    } catch {
      // fall through to the real action, which produces the field error
    }
    const name = String(formData.get("name") ?? "");
    const dueDay = Number(formData.get("dueDay"));
    const categoryIdRaw = String(formData.get("categoryId") ?? "");
    const categoryId = categoryIdRaw === "" ? null : categoryIdRaw;
    const categoryName = categoryId ? (categories.find((c) => c.id === categoryId)?.name ?? null) : null;
    const notes = (formData.get("notes") as string) || null;

    if (mode === "create" && onOptimisticAdd) {
      const { status, dueDate, daysUntilDue } = computeBillStatus({ dueDay, isPaid: false });
      onOptimisticAdd({
        id: `optimistic-${Date.now()}`,
        name,
        amountCents,
        dueDay,
        categoryId,
        categoryName,
        isActive: true,
        notes,
        createdAt: new Date().toISOString(),
        isPaidThisMonth: false,
        status,
        dueDate,
        daysUntilDue,
      });
    } else if (mode === "edit" && bill && onOptimisticUpdate) {
      const { status, dueDate, daysUntilDue } = computeBillStatus({ dueDay, isPaid: bill.isPaidThisMonth });
      onOptimisticUpdate(bill.id, { name, amountCents, dueDay, categoryId, categoryName, notes, status, dueDate, daysUntilDue });
    }
    return boundAction(prevState, formData);
  }

  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill ? (bill.amountCents / 100).toFixed(2) : "");
  const [dueDay, setDueDay] = useState(bill?.dueDay ?? 1);
  const [categoryId, setCategoryId] = useState<string>(bill?.categoryId ?? "");
  const [notes, setNotes] = useState(bill?.notes ?? "");

  useEffect(() => {
    if (state?.ok) {
      onSuccess();
    }
  }, [state, onSuccess]);

  // Belt-and-suspenders fix for the same post-action DOM-reset quirk
  // documented in BudgetForm.tsx/TransactionForm.tsx for <select>.
  const dueDaySelectRef = useRef<HTMLSelectElement>(null);
  const categorySelectRef = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    if (dueDaySelectRef.current && dueDaySelectRef.current.value !== String(dueDay)) {
      dueDaySelectRef.current.value = String(dueDay);
    }
    if (categorySelectRef.current && categorySelectRef.current.value !== categoryId) {
      categorySelectRef.current.value = categoryId;
    }
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
        <label htmlFor={fieldId("dueDay")} className="mb-1 block text-sm font-medium">
          Due day of month
        </label>
        <select
          ref={dueDaySelectRef}
          id={fieldId("dueDay")}
          name="dueDay"
          value={dueDay}
          onChange={(e) => setDueDay(Number(e.target.value))}
          required
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        >
          {DUE_DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-muted">A day past a short month&apos;s end (e.g. 31) falls back to that month&apos;s last day.</p>
        {fieldErrors?.dueDay && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.dueDay[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={fieldId("categoryId")} className="mb-1 block text-sm font-medium">
          Category <span className="font-normal text-muted">(optional)</span>
        </label>
        <select
          ref={categorySelectRef}
          id={fieldId("categoryId")}
          name="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-muted">Needed only to log a transaction automatically when marking this bill paid.</p>
        {fieldErrors?.categoryId && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {fieldErrors.categoryId[0]}
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
          value={notes ?? ""}
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
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add bill" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
