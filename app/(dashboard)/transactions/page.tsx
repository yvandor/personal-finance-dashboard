import { listTransactions, getTransactionsSummary } from "@/server/data/transactions";
import { listCategories } from "@/server/data/categories";
import { transactionFilterSchema } from "@/lib/schemas/transaction";
import { SummaryCards } from "@/components/transactions/SummaryCards";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionFormDialog } from "@/components/transactions/TransactionFormDialog";
import { Pager } from "@/components/transactions/Pager";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90";

// A Server Component: reads searchParams, calls the DAL directly (no
// Server Action needed for a read), and composes presentational
// components. Writes go through server/actions/transactions.ts instead.
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawParams = await searchParams;

  const rawFilters = {
    type: toSingle(rawParams.type),
    categoryId: toSingle(rawParams.categoryId),
    dateFrom: toSingle(rawParams.dateFrom),
    dateTo: toSingle(rawParams.dateTo),
    q: toSingle(rawParams.q),
    take: toSingle(rawParams.take),
    skip: toSingle(rawParams.skip),
  };

  // Parsed once here for the page's own use (pager numbers, active-filter
  // check); listTransactions/getTransactionsSummary re-parse the same raw
  // input themselves, since a DAL function must never trust an
  // already-validated shape from its caller.
  const filters = transactionFilterSchema.parse(rawFilters);
  const hasActiveFilters = Boolean(
    filters.type || filters.categoryId || filters.dateFrom || filters.dateTo || filters.q,
  );

  const [categories, { items, total }, summary] = await Promise.all([
    listCategories(),
    listTransactions(rawFilters),
    getTransactionsSummary(rawFilters),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted">Add, edit, and review your income and expenses.</p>
        </div>
        <TransactionFormDialog mode="create" categories={categories} triggerClassName={PRIMARY_BUTTON_CLASSES}>
          Add transaction
        </TransactionFormDialog>
      </div>

      <SummaryCards summary={summary} />

      <TransactionFilters categories={categories} />

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <TransactionList transactions={items} categories={categories} hasActiveFilters={hasActiveFilters} />
        <Pager
          take={filters.take}
          skip={filters.skip}
          total={total}
          searchParams={Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, toSingle(v)]))}
        />
      </div>
    </div>
  );
}
