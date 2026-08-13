"use client";

import { useOptimistic } from "react";
import { transactionOptimisticReducer, transactionsSummaryOptimisticReducer } from "@/lib/transactions";
import { SummaryCards } from "./SummaryCards";
import { TransactionFilters } from "./TransactionFilters";
import { TransactionFormDialog } from "./TransactionFormDialog";
import { TransactionList } from "./TransactionList";
import { Pager, type PagerProps } from "./Pager";
import type { TransactionDTO, TransactionsSummary } from "@/server/data/transactions";
import type { CategoryDTO } from "@/server/data/categories";
import type { IncomeSourceDTO } from "@/server/data/incomeSources";

interface TransactionsBoardProps {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  /**
   * Active income sources, for the header's "Add transaction" dialog's
   * Source picker -- see TransactionForm.tsx's comment on this same prop.
   * Only threaded to that one create dialog, not to each row's edit
   * dialog (owned by TransactionList.tsx, outside this version's scope).
   */
  incomeSources?: IncomeSourceDTO[];
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

// Owns two useOptimistic overlays -- one for the row list, one for
// SummaryCards' totals -- so the header's "Add transaction" trigger and the
// list below it stay in sync, including the totals, throughout a pending
// transition (e.g. DeleteTransactionButton's undo window). See
// lib/transactions.ts's transactionsSummaryOptimisticReducer for why the
// totals need their own adjustment rather than being derived from the row
// list (pagination means the visible page is not the full matching set).
export function TransactionsBoard({
  transactions,
  categories,
  incomeSources,
  currency,
  hasActiveFilters,
  summary,
  pager,
  isDefaultView,
}: TransactionsBoardProps) {
  const [optimisticTransactions, dispatch] = useOptimistic(transactions, transactionOptimisticReducer);
  const [optimisticSummary, dispatchSummary] = useOptimistic(summary, transactionsSummaryOptimisticReducer);

  // Restoring a transaction (undo, or re-adding after a failed real delete)
  // is never gated by isDefaultView -- unlike a brand-new transaction from
  // the create form, it was already part of the currently-visible (however
  // filtered/paginated) set a moment ago, so both the row and its
  // contribution to the totals belong back unconditionally.
  function restoreTransaction(transaction: TransactionDTO) {
    dispatch({ type: "add", transaction });
    dispatchSummary({ type: "add", transaction });
  }

  function removeTransaction(id: string) {
    const removed = optimisticTransactions.find((t) => t.id === id);
    dispatch({ type: "remove", id });
    if (removed) {
      dispatchSummary({ type: "remove", transaction: removed });
    }
  }

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
          incomeSources={incomeSources}
          triggerClassName={PRIMARY_BUTTON_CLASSES}
          onOptimisticAdd={
            isDefaultView
              ? (transaction) => {
                  dispatch({ type: "add", transaction });
                  dispatchSummary({ type: "add", transaction });
                }
              : undefined
          }
        >
          Add transaction
        </TransactionFormDialog>
      </div>

      <SummaryCards summary={optimisticSummary} currency={currency} />

      <TransactionFilters categories={categories} />

      {/* Boxed-card chrome is desktop-only: the mobile card list below
          renders each transaction as its own rounded-xl card (see
          TransactionCard.tsx), so wrapping the whole list in a second
          border here would double up on mobile. */}
      <div className="md:overflow-hidden md:rounded-xl md:border md:border-border md:bg-surface">
        <TransactionList
          transactions={optimisticTransactions}
          categories={categories}
          currency={currency}
          hasActiveFilters={hasActiveFilters}
          onOptimisticAdd={restoreTransaction}
          onOptimisticUpdate={(id, patch) => dispatch({ type: "update", id, patch })}
          onOptimisticRemove={removeTransaction}
        />
        <div className="mt-3 md:mt-0">
          <Pager {...pager} itemsCount={optimisticTransactions.length} />
        </div>
      </div>
    </>
  );
}
