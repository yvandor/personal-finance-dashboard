import { listRecurringBills } from "@/server/data/recurringBills";
import { listCategories } from "@/server/data/categories";
import { getCurrentUserCurrency } from "@/server/data/users";
import { currentMonthKey } from "@/lib/dates";
import { BillsBoard } from "@/components/bills/BillsBoard";

// A Server Component: reads directly through the DAL, no Server Action
// needed for the read itself. Hands the results to BillsBoard (a client
// component), which owns the useOptimistic overlay shared by the header's
// create dialog and the list below it. Writes go through
// server/actions/recurringBills.ts. `periodMonth` is computed once here so
// every bill's displayed status and the "mark paid" dialog agree on exactly
// which month they mean, instead of the client re-deriving it from its own
// clock (see lib/recurringBills.ts's computeBillStatus).
export default async function BillsPage() {
  const periodMonth = currentMonthKey();

  const [bills, categories, currency] = await Promise.all([
    listRecurringBills(),
    listCategories(),
    getCurrentUserCurrency(),
  ]);

  // Only EXPENSE categories are offered -- a bill's category exists solely
  // to log an expense transaction when marked paid (see
  // server/data/recurringBills.ts's assertBillableCategory).
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <BillsBoard bills={bills} categories={expenseCategories} periodMonth={periodMonth} currency={currency} />
    </div>
  );
}
