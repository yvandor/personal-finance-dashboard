"use client";

import { useOptimistic } from "react";
import { incomeSourceOptimisticReducer } from "@/lib/incomeSources";
import { MonthSelector } from "./MonthSelector";
import { IncomeSourceFormDialog } from "./IncomeSourceFormDialog";
import { IncomeSourceList } from "./IncomeSourceList";
import { IncomeVsExpectedSummary } from "./IncomeVsExpectedSummary";
import type { IncomeSourceManagementDTO } from "@/server/data/incomeSources";
import type { IncomeVsExpectedDTO } from "@/lib/incomeSources";

interface IncomeSourcesBoardProps {
  incomeSources: IncomeSourceManagementDTO[];
  incomeVsExpected: IncomeVsExpectedDTO;
  month: string;
  currency?: string;
}

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground outline-none transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Owns the useOptimistic overlay so the header's "Add income source"
// trigger and the management list below it share one optimistic array --
// same shape as components/categories/CategoriesBoard.tsx. The
// expected-vs-received summary is server-computed per month
// (server/data/incomeSources.ts's getIncomeVsExpected) and re-fetched
// whenever `month` changes via MonthSelector navigating to a new
// `?month=`; it intentionally does not read the optimistic overlay below --
// a freshly added/archived source's effect on this month's numbers is only
// exactly correct once the create/archive round trip actually settles and
// the page's data is refetched.
export function IncomeSourcesBoard({ incomeSources, incomeVsExpected, month, currency }: IncomeSourcesBoardProps) {
  const [optimisticIncomeSources, dispatch] = useOptimistic(incomeSources, incomeSourceOptimisticReducer);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Income Sources</h1>
          <p className="text-sm text-muted">
            Track expected recurring income and compare it against what actually came in each month.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector month={month} />
          <IncomeSourceFormDialog
            mode="create"
            triggerClassName={PRIMARY_BUTTON_CLASSES}
            onOptimisticAdd={(incomeSource) => dispatch({ type: "add", incomeSource })}
          >
            Add income source
          </IncomeSourceFormDialog>
        </div>
      </div>

      <IncomeVsExpectedSummary incomeVsExpected={incomeVsExpected} currency={currency} />

      <IncomeSourceList
        incomeSources={optimisticIncomeSources}
        currency={currency}
        onOptimisticUpdate={(id, patch) => dispatch({ type: "update", id, patch })}
      />
    </>
  );
}
