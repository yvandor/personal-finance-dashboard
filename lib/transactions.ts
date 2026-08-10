import type { TransactionDTO, TransactionsSummary } from "@/server/data/transactions";

export type TransactionOptimisticAction =
  | { type: "add"; transaction: TransactionDTO }
  | { type: "update"; id: string; patch: Partial<TransactionDTO> }
  | { type: "remove"; id: string };

/**
 * Pure reducer for the useOptimistic overlay in
 * components/transactions/TransactionsBoard.tsx -- same convention as
 * lib/budgets.ts's budgetOptimisticReducer. "add" is only ever dispatched
 * from the default (unfiltered, first-page) view -- see
 * app/(dashboard)/transactions/page.tsx's `isDefaultView` -- so re-sorting
 * by [date desc, id desc] here matches exactly what
 * server/data/transactions.ts's listTransactions would return for that view;
 * inserting into a filtered or paginated view is deliberately never
 * attempted (it could put the row somewhere misleading, or hide a row that
 * doesn't match the active filter).
 */
export function transactionOptimisticReducer(
  state: TransactionDTO[],
  action: TransactionOptimisticAction,
): TransactionDTO[] {
  switch (action.type) {
    case "add":
      return [...state, action.transaction].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.id < b.id ? 1 : -1;
      });
    case "update":
      return state.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t));
    case "remove":
      return state.filter((t) => t.id !== action.id);
  }
}

export type TransactionsSummaryOptimisticAction =
  | { type: "add"; transaction: Pick<TransactionDTO, "type" | "amountCents"> }
  | { type: "remove"; transaction: Pick<TransactionDTO, "type" | "amountCents"> };

/**
 * Keeps SummaryCards' totals in sync with the optimistic transaction list.
 * `summary` (server/data/transactions.ts's getTransactionsSummary) is
 * fetched separately from the paginated `transactions` list -- it reflects
 * every matching row, not just the current page -- so it can't be
 * recomputed by summing `optimisticTransactions` (wrong once pagination
 * hides rows). Adjusting by the one transaction's own signed delta is
 * correct regardless of pagination: adding or removing a row changes the
 * true sum by exactly that row's amount, nothing else needs to be known.
 * Without this, the undo-on-delete window (components/transactions/DeleteTransactionButton.tsx)
 * would leave the totals visibly stale for the whole window -- the list
 * updates instantly, the numbers above it wouldn't have, until now.
 */
export function transactionsSummaryOptimisticReducer(
  summary: TransactionsSummary,
  action: TransactionsSummaryOptimisticAction,
): TransactionsSummary {
  const sign = action.type === "add" ? 1 : -1;
  const delta = sign * action.transaction.amountCents;
  if (action.transaction.type === "INCOME") {
    return {
      ...summary,
      incomeCents: summary.incomeCents + delta,
      netCents: summary.netCents + delta,
      count: summary.count + sign,
    };
  }
  return {
    ...summary,
    expenseCents: summary.expenseCents + delta,
    netCents: summary.netCents - delta,
    count: summary.count + sign,
  };
}
