import { Money } from "@/components/ui/Money";
import { TransactionFormDialog } from "./TransactionFormDialog";
import { DeleteTransactionButton } from "./DeleteTransactionButton";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";

interface TransactionCardProps {
  transaction: TransactionDTO;
  categoryName: string;
  categories: CategoryDTO[];
  currency?: string;
  onOptimisticAdd?: (transaction: TransactionDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<TransactionDTO>) => void;
  onOptimisticRemove?: (id: string) => void;
}

export function TransactionCard({
  transaction,
  categoryName,
  categories,
  currency,
  onOptimisticAdd,
  onOptimisticUpdate,
  onOptimisticRemove,
}: TransactionCardProps) {
  const signedCents = transaction.type === "EXPENSE" ? -transaction.amountCents : transaction.amountCents;

  return (
    <div className="border-b border-border p-4 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{transaction.description}</p>
          <p className="text-sm text-muted">
            {categoryName} · {transaction.date}
          </p>
        </div>
        <Money cents={signedCents} currency={currency} className="shrink-0 font-medium" />
      </div>
      <div className="mt-3 flex gap-2">
        <TransactionFormDialog
          mode="edit"
          transaction={transaction}
          categories={categories}
          triggerClassName="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-hover"
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
