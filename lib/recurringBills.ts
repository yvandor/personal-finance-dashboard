import { currentMonthKey, clampDayToMonth } from "@/lib/dates";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";

export type BillStatus = "PAID" | "OVERDUE" | "DUE_SOON" | "UPCOMING";

export interface BillStatusResult {
  status: BillStatus;
  /** This period's due date, "YYYY-MM-DD" -- dueDay clamped to `now`'s month
   * via lib/dates.ts's clampDayToMonth, so dueDay=31 reads as "end of month"
   * in April, not an invalid date. */
  dueDate: string;
  /** Calendar days from `now` to dueDate; negative once the due date has passed. */
  daysUntilDue: number;
}

/** A bill due within this many days (and not yet paid) is "due soon" rather than merely "upcoming". */
const DUE_SOON_WINDOW_DAYS = 3;
const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Pure status math for a recurring bill's *current* billing period, kept
 * dependency-free and injectable-`now` (same convention as
 * lib/savingsGoals.ts's computeGoalPace) so it's unit-testable without the
 * wall clock. Reminder-only, matching prisma/schema.prisma's comment on
 * RecurringBill: this never looks at a transaction, only the `isPaid` flag
 * the caller already resolved from the explicit RecurringBillPayment ledger
 * for the current month (see server/data/recurringBills.ts's listRecurringBills).
 *
 * dueDay is clamped against `now`'s own month, not a fixed calendar --
 * dueDay=31 lands on the 30th in April, the 28th (or 29th in a leap year) in
 * February, and the 31st in any 31-day month, all from the exact same
 * stored value.
 */
export function computeBillStatus(params: { dueDay: number; isPaid: boolean; now?: Date }): BillStatusResult {
  const now = params.now ?? new Date();
  const monthKey = currentMonthKey(now);
  const clampedDay = clampDayToMonth(params.dueDay, monthKey);
  const dueDate = `${monthKey}-${pad2(clampedDay)}`;

  const dueDateUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), clampedDay);
  const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysUntilDue = Math.round((dueDateUTC - nowUTC) / MS_PER_DAY);

  let status: BillStatus;
  if (params.isPaid) {
    status = "PAID";
  } else if (daysUntilDue < 0) {
    status = "OVERDUE";
  } else if (daysUntilDue <= DUE_SOON_WINDOW_DAYS) {
    status = "DUE_SOON";
  } else {
    status = "UPCOMING";
  }

  return { status, dueDate, daysUntilDue };
}

export type BillOptimisticAction =
  | { type: "add"; bill: RecurringBillWithStatusDTO }
  | { type: "update"; id: string; patch: Partial<RecurringBillWithStatusDTO> };

/**
 * Pure reducer for the useOptimistic overlay in
 * components/bills/BillsBoard.tsx -- same convention as
 * lib/categories.ts's categoryOptimisticReducer. No "remove" action:
 * archiving a bill (isActive: false) is an "update", the same reasoning as
 * category archiving -- see server/data/recurringBills.ts's
 * archiveRecurringBill. Marking a bill paid is deliberately NOT optimistic
 * (see components/bills/MarkBillPaidForm.tsx's comment), so it dispatches no
 * action here either -- the list picks up the real result via the page's
 * automatic revalidation.
 */
export function billOptimisticReducer(
  state: RecurringBillWithStatusDTO[],
  action: BillOptimisticAction,
): RecurringBillWithStatusDTO[] {
  switch (action.type) {
    case "add":
      return [...state, action.bill];
    case "update":
      return state.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b));
  }
}
