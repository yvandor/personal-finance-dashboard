import { listTransactions, getTransactionsSummary } from "@/server/data/transactions";
import { listCategories } from "@/server/data/categories";
import { listIncomeSources } from "@/server/data/incomeSources";
import { getCurrentUserCurrency } from "@/server/data/users";
import { transactionFilterSchema } from "@/lib/schemas/transaction";
import { TransactionsBoard } from "@/components/transactions/TransactionsBoard";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// A Server Component: reads searchParams, calls the DAL directly (no
// Server Action needed for a read), and hands the results to
// TransactionsBoard (a client component), which owns the useOptimistic
// overlay shared by the header's create dialog and the list below it.
// Writes go through server/actions/transactions.ts.
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
    cursor: toSingle(rawParams.cursor),
    direction: toSingle(rawParams.direction),
  };

  // Parsed once here for the page's own use (active-filter check);
  // listTransactions/getTransactionsSummary re-parse the same raw input
  // themselves, since a DAL function must never trust an already-validated
  // shape from its caller.
  const filters = transactionFilterSchema.parse(rawFilters);
  const hasActiveFilters = Boolean(
    filters.type || filters.categoryId || filters.dateFrom || filters.dateTo || filters.q,
  );
  // An optimistic insert only ever makes sense on the unfiltered first
  // page -- the same real ordering listTransactions itself would return a
  // new transaction into (see lib/transactions.ts's comment). Any filter
  // or a cursor means the currently-displayed rows are a narrower or
  // shifted window that a client-side insert can't reliably place into.
  const isDefaultView = !hasActiveFilters && !filters.cursor;

  const [categories, incomeSources, currency, { items, total, hasNext, hasPrev, nextCursor, prevCursor }, summary] =
    await Promise.all([
      listCategories(),
      listIncomeSources({ isActive: true }),
      getCurrentUserCurrency(),
      listTransactions(rawFilters),
      getTransactionsSummary(rawFilters),
    ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <TransactionsBoard
        transactions={items}
        categories={categories}
        incomeSources={incomeSources}
        currency={currency}
        hasActiveFilters={hasActiveFilters}
        summary={summary}
        isDefaultView={isDefaultView}
        pager={{
          total,
          hasNext,
          hasPrev,
          nextCursor,
          prevCursor,
          searchParams: Object.fromEntries(Object.entries(rawParams).map(([k, v]) => [k, toSingle(v)])),
        }}
      />
    </div>
  );
}
