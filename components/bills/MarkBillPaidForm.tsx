"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { markBillPaidAction } from "@/server/actions/recurringBills";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import type { RecurringBillWithStatusDTO, MarkBillPaidResult } from "@/server/data/recurringBills";
import type { ActionResult } from "@/lib/result";

interface MarkBillPaidFormProps {
  bill: RecurringBillWithStatusDTO;
  /** "YYYY-MM" -- fixed for the lifetime of this form, computed once
   * server-side (see app/(dashboard)/bills/page.tsx) so it always matches
   * the month the bill's displayed status was computed against. */
  periodMonth: string;
  currency?: string;
  onSuccess: () => void;
}

type FormState = ActionResult<MarkBillPaidResult> | null;

// Deliberately NOT optimistic (unlike BillForm/ArchiveBillButton) --
// marking paid can create a real Transaction row (see
// server/data/recurringBills.ts's markBillPaid, wrapped in one
// prisma.$transaction), and guessing that outcome client-side before the
// write actually commits risks the UI showing "paid" for a mutation that
// failed. The list still updates promptly without a manual dispatch here:
// markBillPaidAction's revalidatePath triggers Next's automatic Server
// Component refresh once this action settles, the same round trip every
// other write in this app takes, just without the optimistic overlay.
export function MarkBillPaidForm({ bill, periodMonth, currency, onSuccess }: MarkBillPaidFormProps) {
  const boundAction = markBillPaidAction.bind(null, bill.id);
  const [state, formAction, pending] = useActionState<FormState, FormData>(boundAction, null);
  const [logTransaction, setLogTransaction] = useState(bill.categoryId !== null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (state?.ok) {
      onSuccess();
    }
  }, [state, onSuccess]);

  const uid = useId();
  const fieldId = (field: string) => `${uid}-${field}`;
  const generalError = state && !state.ok ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="periodMonth" value={periodMonth} />
      <p className="text-sm text-muted">
        Marking <span className="font-medium text-foreground">{bill.name}</span> (
        <Money cents={-bill.amountCents} currency={currency} />) paid for {periodMonth}.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="logTransaction"
          value="true"
          checked={logTransaction}
          onChange={(e) => setLogTransaction(e.target.checked)}
          disabled={!bill.categoryId}
        />
        Log an expense transaction for this payment
      </label>
      {!bill.categoryId && (
        <p className="text-sm text-muted">Add a category to this bill to log a transaction automatically.</p>
      )}

      {logTransaction && bill.categoryId && (
        <div>
          <label htmlFor={fieldId("date")} className="mb-1 block text-sm font-medium">
            Transaction date
          </label>
          <input
            id={fieldId("date")}
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
          />
        </div>
      )}

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
          {pending ? "Marking paid…" : "Mark paid"}
        </Button>
      </div>
    </form>
  );
}
