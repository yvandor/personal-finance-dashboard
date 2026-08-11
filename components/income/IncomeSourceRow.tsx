import { IncomeSourceFormDialog } from "./IncomeSourceFormDialog";
import { ArchiveIncomeSourceButton } from "./ArchiveIncomeSourceButton";
import { Money } from "@/components/ui/Money";
import type { IncomeSourceManagementDTO } from "@/server/data/incomeSources";

interface IncomeSourceRowProps {
  incomeSource: IncomeSourceManagementDTO;
  currency?: string;
  onOptimisticUpdate?: (id: string, patch: Partial<IncomeSourceManagementDTO>) => void;
}

function ordinal(day: number): string {
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`;
  if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`;
  if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`;
  return `${day}th`;
}

export function IncomeSourceRow({ incomeSource, currency, onOptimisticUpdate }: IncomeSourceRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{incomeSource.name}</p>
        <p className="text-sm text-muted">
          <Money cents={incomeSource.amountCents} currency={currency} /> · {ordinal(incomeSource.payDay)} of the month
        </p>
        <p className="text-sm text-muted">
          {incomeSource.transactionCount === 0
            ? "Not currently in use"
            : `${incomeSource.transactionCount} tagged transaction${incomeSource.transactionCount === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {incomeSource.isActive && (
          <IncomeSourceFormDialog
            mode="edit"
            incomeSource={incomeSource}
            triggerClassName="rounded-md p-2.5 text-muted hover:bg-surface-hover hover:text-accent"
            triggerAriaLabel={`Edit ${incomeSource.name}`}
            onOptimisticUpdate={onOptimisticUpdate}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </IncomeSourceFormDialog>
        )}
        <ArchiveIncomeSourceButton
          id={incomeSource.id}
          name={incomeSource.name}
          isActive={incomeSource.isActive}
          transactionCount={incomeSource.transactionCount}
          onOptimisticUpdate={onOptimisticUpdate}
        />
      </div>
    </div>
  );
}
