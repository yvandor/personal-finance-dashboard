import { BillRow } from "./BillRow";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";
import type { CategoryDTO } from "@/server/data/categories";

interface BillListProps {
  bills: RecurringBillWithStatusDTO[];
  categories: CategoryDTO[];
  periodMonth: string;
  currency?: string;
  onOptimisticUpdate?: (id: string, patch: Partial<RecurringBillWithStatusDTO>) => void;
}

function Section({
  title,
  items,
  categories,
  periodMonth,
  currency,
  onOptimisticUpdate,
}: {
  title: string;
  items: RecurringBillWithStatusDTO[];
  categories: CategoryDTO[];
  periodMonth: string;
  currency?: string;
  onOptimisticUpdate?: (id: string, patch: Partial<RecurringBillWithStatusDTO>) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        {items.map((b) => (
          <BillRow
            key={b.id}
            bill={b}
            categories={categories}
            periodMonth={periodMonth}
            currency={currency}
            onOptimisticUpdate={onOptimisticUpdate}
          />
        ))}
      </div>
    </div>
  );
}

// Active bills then a separate Archived section -- mirrors
// CategoryList.tsx's grouping. Bills already arrive sorted by due day (see
// server/data/recurringBills.ts's listRecurringBills); this only splits them
// into the two sections.
export function BillList({ bills, categories, periodMonth, currency, onOptimisticUpdate }: BillListProps) {
  const active = bills.filter((b) => b.isActive);
  const archived = bills.filter((b) => !b.isActive);

  if (bills.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-4 py-16 text-center">
        <p className="text-sm font-medium">No bills yet</p>
        <p className="text-sm text-muted">Add a recurring bill to get monthly payment reminders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Active bills" items={active} categories={categories} periodMonth={periodMonth} currency={currency} onOptimisticUpdate={onOptimisticUpdate} />
      <Section title="Archived" items={archived} categories={categories} periodMonth={periodMonth} currency={currency} onOptimisticUpdate={onOptimisticUpdate} />
    </div>
  );
}
