"use client";

import { useOptimistic } from "react";
import { transactionOptimisticReducer } from "@/lib/transactions";
import { SummaryCards } from "./SummaryCards";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionFormDialog } from "./TransactionFormDialog";
import { TransactionList } from "./TransactionList";
import { Pager, type PagerProps } from "./Pager";
import type { TransactionDTO, TransactionsSummary } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";

interface TransactionsBoardProps {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  currency?: string;
  hasActiveFilters: boolean;
  summary: TransactionsSummary;
  pager: Omit<PagerProps, "itemsCount">;
  /** Only true for the unfiltered, first page -- see lib/transactions.ts's
   * comment on why an optimistic insert is skipped everywhere else. */
  isDefaultView: boolean;
}

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90";

// Owns the useOptimistic overlay so the header's "Add transaction" trigger
// and the list below it share one optimistic array -- same shape as
// components/budgets/BudgetsBoard.tsx. Edit/delete are wired regardless of
// view (they mutate a row already present on screen); create is only wired
// when isDefaultView is true.
export function TransactionsBoard({
  transactions,
  categories,
  currency,
  hasActiveFilters,
  summary,
  pager,
  isDefaultView,
}: TransactionsBoardProps) {
  const [optimisticTransactions, dispatch] = useOptimistic(transactions, transactionOptimisticReducer);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted">Add, edit, and review your income and expenses.</p>
        </div>
        <TransactionFormDialog
          mode="create"
          categories={categories}
          triggerClassName={PRIMARY_BUTTON_CLASSES}
          onOptimisticAdd={isDefaultView ? (transaction) => dispatch({ type: "add", transaction }) : undefined}
        >
          Add transaction
        </TransactionFormDialog>
      </div>

      <SummaryCards summary={summary} currency={currency} />

      <TransactionFilters categories={categories} />

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <TransactionList
          transactions={optimisticTransactions}
          categories={categories}
          currency={currency}
          hasActiveFilters={hasActiveFilters}
          onOptimisticUpdate={(id, patch) => dispatch({ type: "update", id, patch })}
          onOptimisticRemove={(id) => dispatch({ type: "remove", id })}
        />
        <Pager {...pager} itemsCount={optimisticTransactions.length} />
      </div>
    </>
  );
}
