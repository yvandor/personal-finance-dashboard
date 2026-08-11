import { Money } from "@/components/ui/Money";
import { BillFormDialog } from "./BillFormDialog";
import { MarkBillPaidDialog } from "./MarkBillPaidDialog";
import { ArchiveBillButton } from "./ArchiveBillButton";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";
import type { CategoryDTO } from "@/server/data/categories";

interface BillRowProps {
  bill: RecurringBillWithStatusDTO;
  categories: CategoryDTO[];
  periodMonth: string;
  currency?: string;
  onOptimisticUpdate?: (id: string, patch: Partial<RecurringBillWithStatusDTO>) => void;
}

const STATUS_LABEL: Record<RecurringBillWithStatusDTO["status"], string> = {
  PAID: "Paid",
  OVERDUE: "Overdue",
  DUE_SOON: "Due soon",
  UPCOMING: "Upcoming",
};

// Status is always paired with the STATUS_LABEL text, never color-only --
// same discipline as BudgetProgressBar/GoalCard's PaceHint.
const STATUS_CLASSES: Record<RecurringBillWithStatusDTO["status"], string> = {
  PAID: "text-income",
  OVERDUE: "text-danger",
  DUE_SOON: "text-amber-500",
  UPCOMING: "text-muted",
};

function formatDueDate(dueDate: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${dueDate}T00:00:00Z`),
  );
}

export function BillRow({ bill, categories, periodMonth, currency, onOptimisticUpdate }: BillRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {bill.name}
          {bill.categoryName && <span className="ml-2 text-xs font-normal text-muted">{bill.categoryName}</span>}
        </p>
        <p className="text-sm text-muted">
          <Money cents={-bill.amountCents} currency={currency} className="text-foreground" /> · Due{" "}
          {formatDueDate(bill.dueDate)} · <span className={`font-medium ${STATUS_CLASSES[bill.status]}`}>{STATUS_LABEL[bill.status]}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {bill.isActive && !bill.isPaidThisMonth && (
          <MarkBillPaidDialog
            bill={bill}
            periodMonth={periodMonth}
            currency={currency}
            triggerClassName="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
            triggerAriaLabel={`Mark ${bill.name} paid`}
          >
            Mark paid
          </MarkBillPaidDialog>
        )}
        {bill.isActive && (
          <BillFormDialog
            mode="edit"
            bill={bill}
            categories={categories}
            triggerClassName="rounded-md p-2.5 text-muted hover:bg-surface-hover hover:text-accent"
            triggerAriaLabel={`Edit ${bill.name}`}
            onOptimisticUpdate={onOptimisticUpdate}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </BillFormDialog>
        )}
        <ArchiveBillButton id={bill.id} name={bill.name} isActive={bill.isActive} onOptimisticUpdate={onOptimisticUpdate} />
      </div>
    </div>
  );
}
