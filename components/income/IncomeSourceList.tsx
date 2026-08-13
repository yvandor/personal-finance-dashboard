import { IncomeSourceRow } from "./IncomeSourceRow";
import type { IncomeSourceManagementDTO } from "@/server/data/incomeSources";

interface IncomeSourceListProps {
  incomeSources: IncomeSourceManagementDTO[];
  currency?: string;
  onOptimisticUpdate?: (id: string, patch: Partial<IncomeSourceManagementDTO>) => void;
}

function Section({
  title,
  items,
  currency,
  onOptimisticUpdate,
}: {
  title: string;
  items: IncomeSourceManagementDTO[];
  currency?: string;
  onOptimisticUpdate?: (id: string, patch: Partial<IncomeSourceManagementDTO>) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        {items.map((s) => (
          <IncomeSourceRow key={s.id} incomeSource={s} currency={currency} onOptimisticUpdate={onOptimisticUpdate} />
        ))}
      </div>
    </div>
  );
}

// Grouped active/archived -- same shape as
// components/categories/CategoryList.tsx.
export function IncomeSourceList({ incomeSources, currency, onOptimisticUpdate }: IncomeSourceListProps) {
  const active = incomeSources.filter((s) => s.isActive);
  const archived = incomeSources.filter((s) => !s.isActive);

  if (incomeSources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-4 py-16 text-center">
        <p className="text-sm font-medium">No income sources yet</p>
        <p className="text-sm text-muted">Add an income source to track expected vs. received income.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Active" items={active} currency={currency} onOptimisticUpdate={onOptimisticUpdate} />
      <Section title="Archived" items={archived} currency={currency} onOptimisticUpdate={onOptimisticUpdate} />
    </div>
  );
}
