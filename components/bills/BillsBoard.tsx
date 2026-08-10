"use client";

import { useOptimistic } from "react";
import { billOptimisticReducer } from "@/lib/recurringBills";
import { BillFormDialog } from "./BillFormDialog";
import { BillList } from "./BillList";
import type { RecurringBillWithStatusDTO } from "@/server/data/recurringBills";
import type { CategoryDTO } from "@/server/data/categories";

interface BillsBoardProps {
  bills: RecurringBillWithStatusDTO[];
  /** EXPENSE categories only -- see app/(dashboard)/bills/page.tsx. */
  categories: CategoryDTO[];
  /** "YYYY-MM" -- the month bills' displayed status was computed against. */
  periodMonth: string;
  currency?: string;
}

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90";

// Owns the useOptimistic overlay so the header's "Add bill" trigger and the
// list below it share one optimistic array -- same shape as
// components/categories/CategoriesBoard.tsx.
export function BillsBoard({ bills, categories, periodMonth, currency }: BillsBoardProps) {
  const [optimisticBills, dispatch] = useOptimistic(bills, billOptimisticReducer);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bills</h1>
          <p className="text-sm text-muted">
            Track recurring bills and mark them paid each month. This is a reminder only -- nothing is charged automatically.
          </p>
        </div>
        <BillFormDialog
          mode="create"
          categories={categories}
          triggerClassName={PRIMARY_BUTTON_CLASSES}
          onOptimisticAdd={(bill) => dispatch({ type: "add", bill })}
        >
          Add bill
        </BillFormDialog>
      </div>

      <BillList
        bills={optimisticBills}
        categories={categories}
        periodMonth={periodMonth}
        currency={currency}
        onOptimisticUpdate={(id, patch) => dispatch({ type: "update", id, patch })}
      />
    </>
  );
}
