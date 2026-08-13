import { Money } from "@/components/ui/Money";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { TransactionFormDialog } from "./TransactionFormDialog";
import { DeleteTransactionButton } from "./DeleteTransactionButton";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";

interface TransactionCardProps {
  transaction: TransactionDTO;
  categoryName: string;
  categoryColor: string;
  categories: CategoryDTO[];
  currency?: string;
  onOptimisticAdd?: (transaction: TransactionDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<TransactionDTO>) => void;
  onOptimisticRemove?: (id: string) => void;
}

export function TransactionCard({
  transaction,
  categoryName,
  categoryColor,
  categories,
  currency,
  onOptimisticAdd,
  onOptimisticUpdate,
  onOptimisticRemove,
}: TransactionCardProps) {
  const signedCents = transaction.type === "EXPENSE" ? -transaction.amountCents : transaction.amountCents;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{transaction.description}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted">
            <CategoryBadge name={categoryName} color={categoryColor} className="min-w-0 shrink" />
            <span aria-hidden="true">·</span>
            <span className="shrink-0">{transaction.date}</span>
          </div>
        </div>
        <Money cents={signedCents} currency={currency} className="shrink-0 font-medium" />
      </div>
      <div className="mt-3 flex gap-2">
        <TransactionFormDialog
          mode="edit"
          transaction={transaction}
          categories={categories}
          triggerClassName="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong px-4 text-sm font-medium outline-none transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onOptimisticUpdate={onOptimisticUpdate}
        >
          Edit
        </TransactionFormDialog>
        <DeleteTransactionButton
          transaction={transaction}
          onOptimisticAdd={onOptimisticAdd}
          onOptimisticRemove={onOptimisticRemove}
        />
      </div>
    </div>
  );
}
