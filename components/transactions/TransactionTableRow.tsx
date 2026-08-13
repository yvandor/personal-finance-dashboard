import { Money } from "@/components/ui/Money";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { TransactionFormDialog } from "./TransactionFormDialog";
import { DeleteTransactionButton } from "./DeleteTransactionButton";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";

interface TransactionTableRowProps {
  transaction: TransactionDTO;
  categoryName: string;
  categoryColor: string;
  categories: CategoryDTO[];
  currency?: string;
  onOptimisticAdd?: (transaction: TransactionDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<TransactionDTO>) => void;
  onOptimisticRemove?: (id: string) => void;
}

export function TransactionTableRow({
  transaction,
  categoryName,
  categoryColor,
  categories,
  currency,
  onOptimisticAdd,
  onOptimisticUpdate,
  onOptimisticRemove,
}: TransactionTableRowProps) {
  const signedCents = transaction.type === "EXPENSE" ? -transaction.amountCents : transaction.amountCents;

  return (
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-surface-hover">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">{transaction.date}</td>
      <td className="px-4 py-3 text-sm">{transaction.description}</td>
      <td className="max-w-[180px] px-4 py-3 text-sm text-muted">
        <CategoryBadge name={categoryName} color={categoryColor} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm capitalize text-muted">{transaction.type.toLowerCase()}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
        <Money cents={signedCents} currency={currency} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <div className="flex justify-end gap-1">
          <TransactionFormDialog
            mode="edit"
            transaction={transaction}
            categories={categories}
            triggerClassName="inline-flex size-11 items-center justify-center rounded-md text-muted outline-none transition-colors hover:bg-surface-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            triggerAriaLabel={`Edit ${transaction.description}`}
            onOptimisticUpdate={onOptimisticUpdate}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </TransactionFormDialog>
          <DeleteTransactionButton
            transaction={transaction}
            compact
            onOptimisticAdd={onOptimisticAdd}
            onOptimisticRemove={onOptimisticRemove}
          />
        </div>
      </td>
    </tr>
  );
}
