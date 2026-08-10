import { TransactionTableRow } from "./TransactionTableRow";
import { TransactionCard } from "./TransactionCard";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";

interface TransactionListProps {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  currency?: string;
  hasActiveFilters: boolean;
  onOptimisticAdd?: (transaction: TransactionDTO) => void;
  onOptimisticUpdate?: (id: string, patch: Partial<TransactionDTO>) => void;
  onOptimisticRemove?: (id: string) => void;
}

// Renders both the desktop table and the mobile card list, one CSS-hidden
// via Tailwind breakpoints -- no client JS, no duplicate data fetch, just
// slightly more server-rendered HTML than a single shared tree would send.
export function TransactionList({
  transactions,
  categories,
  currency,
  hasActiveFilters,
  onOptimisticAdd,
  onOptimisticUpdate,
  onOptimisticRemove,
}: TransactionListProps) {
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-4 py-16 text-center">
        <p className="text-sm font-medium">
          {hasActiveFilters ? "No transactions match these filters" : "No transactions yet"}
        </p>
        <p className="text-sm text-muted">
          {hasActiveFilters
            ? "Try widening your search or clearing filters."
            : "Add your first transaction to get started."}
        </p>
      </div>
    );
  }

  return (
    <>
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted">
            <th scope="col" className="px-4 py-3 font-medium">
              Date
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Description
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Category
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Type
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Amount
            </th>
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <TransactionTableRow
              key={t.id}
              transaction={t}
              categoryName={categoryNameById.get(t.categoryId ?? "") ?? "Uncategorized"}
              categories={categories}
              currency={currency}
              onOptimisticAdd={onOptimisticAdd}
              onOptimisticUpdate={onOptimisticUpdate}
              onOptimisticRemove={onOptimisticRemove}
            />
          ))}
        </tbody>
      </table>

      <div className="md:hidden">
        {transactions.map((t) => (
          <TransactionCard
            key={t.id}
            transaction={t}
            categoryName={categoryNameById.get(t.categoryId ?? "") ?? "Uncategorized"}
            categories={categories}
            currency={currency}
            onOptimisticAdd={onOptimisticAdd}
            onOptimisticUpdate={onOptimisticUpdate}
            onOptimisticRemove={onOptimisticRemove}
          />
        ))}
      </div>
    </>
  );
}
