import { Money } from "@/components/ui/Money";
import { TransactionFormDialog } from "./TransactionFormDialog";
import { DeleteTransactionButton } from "./DeleteTransactionButton";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";

interface TransactionTableRowProps {
  transaction: TransactionDTO;
  categoryName: string;
  categories: CategoryDTO[];
  currency?: string;
  onOptimisticUpdate?: (id: string, patch: Partial<TransactionDTO>) => void;
  onOptimisticRemove?: (id: string) => void;
}

export function TransactionTableRow({
  transaction,
  categoryName,
  categories,
  currency,
  onOptimisticUpdate,
  onOptimisticRemove,
}: TransactionTableRowProps) {
  const signedCents = transaction.type === "EXPENSE" ? -transaction.amountCents : transaction.amountCents;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-hover">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">{transaction.date}</td>
      <td className="px-4 py-3 text-sm">{transaction.description}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">{categoryName}</td>
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
            triggerClassName="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-accent"
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
            id={transaction.id}
            description={transaction.description}
            compact
            onOptimisticRemove={onOptimisticRemove}
          />
        </div>
      </td>
    </tr>
  );
}
