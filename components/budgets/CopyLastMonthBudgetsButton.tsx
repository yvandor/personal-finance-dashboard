"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyBudgetsFromMonthAction } from "@/server/actions/budgets";
import { useToast } from "@/components/ui/ToastProvider";
import { shiftMonthKey } from "@/lib/dates";

interface CopyLastMonthBudgetsButtonProps {
  month: string;
  className?: string;
}

// Deliberately not optimistic (unlike the add/edit/delete flows elsewhere on
// this board): copyBudgetsFromMonth returns only a count, not the created
// rows' full BudgetProgressDTOs (spentCents, percentUsed, etc. would all
// need recomputing client-side for no real benefit -- this is a bulk,
// occasional-use utility action, not part of the core per-row optimistic
// requirement). A plain pending state plus a toast summary, then
// router.refresh() to pick up the server-revalidated data, mirrors how
// MarkBillPaidDialog handles its own non-optimistic mutation.
export function CopyLastMonthBudgetsButton({ month, className }: CopyLastMonthBudgetsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { showNotice } = useToast();
  const router = useRouter();
  const fromMonth = shiftMonthKey(month, -1);

  function handleClick() {
    startTransition(async () => {
      const result = await copyBudgetsFromMonthAction({ fromMonth, toMonth: month }, null);
      if (!result.ok) {
        showNotice(`Couldn't copy last month's budgets: ${result.error}`);
        return;
      }
      const { copiedCount, skippedCount } = result.data;
      if (copiedCount === 0) {
        showNotice(
          skippedCount > 0
            ? "Every category from last month is already budgeted this month."
            : "No budgets found for last month.",
        );
      } else {
        showNotice(
          `Copied ${copiedCount} ${copiedCount === 1 ? "budget" : "budgets"} from last month` +
            (skippedCount > 0 ? ` (${skippedCount} already budgeted this month, skipped)` : ""),
        );
      }
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className={className}>
      {isPending ? "Copying…" : "Copy last month's budgets"}
    </button>
  );
}
