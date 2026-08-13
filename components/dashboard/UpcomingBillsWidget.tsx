import Link from "next/link";
import { Money } from "@/components/ui/Money";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";

interface UpcomingBillsWidgetProps {
  bills: RecurringBillWithStatusDTO[];
  currency?: string;
}

const STATUS_LABEL: Record<RecurringBillWithStatusDTO["status"], string> = {
  PAID: "Paid",
  OVERDUE: "Overdue",
  DUE_SOON: "Due soon",
  UPCOMING: "Upcoming",
};

// Same discipline as components/bills/BillRow.tsx: status is always paired
// with its text label, never color-only.
const STATUS_CLASSES: Record<RecurringBillWithStatusDTO["status"], string> = {
  PAID: "text-income",
  OVERDUE: "text-danger",
  DUE_SOON: "text-amber-500",
  UPCOMING: "text-muted",
};

const MAX_SHOWN = 5;

function formatDueDate(dueDate: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${dueDate}T00:00:00Z`),
  );
}

// A slim link/summary rather than the full mark-paid UI -- same reasoning
// as BudgetStatusSummary: the /bills page is where bill detail and actions
// live, this just surfaces what needs attention. Paid bills are excluded
// (nothing to act on) and the remainder is sorted soonest-due-first, same
// order listRecurringBills itself already returns.
export function UpcomingBillsWidget({ bills, currency }: UpcomingBillsWidgetProps) {
  const active = bills.filter((b) => b.isActive);
  const outstanding = active.filter((b) => b.status !== "PAID").slice(0, MAX_SHOWN);

  if (active.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm">
          No recurring bills set up.{" "}
          <Link href="/bills" className="font-medium text-accent hover:underline">
            Add one
          </Link>
          .
        </p>
      </section>
    );
  }

  if (outstanding.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm">
          <span className="font-medium text-income">All bills paid</span> for this month.{" "}
          <Link href="/bills" className="font-medium text-accent hover:underline">
            View bills
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Upcoming bills</h2>
        <Link href="/bills" className="text-sm font-medium text-accent hover:underline">
          View bills
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {outstanding.map((bill) => (
          <li key={bill.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{bill.name}</span>
            <span className="shrink-0 text-muted">
              <Money cents={-bill.amountCents} currency={currency} className="text-foreground" /> · Due{" "}
              {formatDueDate(bill.dueDate)} ·{" "}
              <span className={`font-medium ${STATUS_CLASSES[bill.status]}`}>{STATUS_LABEL[bill.status]}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
