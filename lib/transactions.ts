import type { TransactionDTO } from "@/server/data/transactions";

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
