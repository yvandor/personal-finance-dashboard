import Link from "next/link";
import { Money } from "@/components/ui/Money";
import type { TransactionDTO } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";

interface RecentTransactionsProps {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  currency?: string;
}

// Read-only preview -- no edit/delete here, that's what the "View all"
// link is for. Deliberately doesn't duplicate TransactionFormDialog's add
// flow either, to keep this slice scoped to the dashboard-analytics task.
export function RecentTransactions({ transactions, categories, currency }: RecentTransactionsProps) {
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <section aria-labelledby="recent-transactions-heading" className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 id="recent-transactions-heading" className="text-sm font-semibold">
          Recent transactions
        </h2>
        <Link href="/transactions" className="text-sm font-medium text-accent hover:underline">
          View all transactions
        </Link>
      </div>

      {transactions.length === 0 ? (
        <p className="mt-4 py-8 text-center text-sm text-muted">
          No transactions yet.{" "}
          <Link href="/transactions" className="font-medium text-accent hover:underline">
            Add your first one
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {transactions.map((t) => {
            const signedCents = t.type === "EXPENSE" ? -t.amountCents : t.amountCents;
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-muted">
                    {categoryNameById.get(t.categoryId ?? "") ?? "Uncategorized"} · {t.date}
                  </p>
                </div>
                <Money cents={signedCents} currency={currency} className="shrink-0 text-sm font-medium" />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
