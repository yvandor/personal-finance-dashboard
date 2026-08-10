import { listBudgetsWithProgress } from "@/server/data/budgets";
import { listCategories } from "@/server/data/categories";
import { getCurrentUserCurrency } from "@/server/data/users";
import { currentMonthKey } from "@/lib/dates";
import { filterAvailableBudgetCategories } from "@/lib/budgets";
import { BudgetsBoard } from "@/components/budgets/BudgetsBoard";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// A Server Component: reads searchParams, calls the DAL directly (no
// Server Action needed for a read), and hands the results to BudgetsBoard
// (a client component), which owns the useOptimistic overlay shared by the
// header's create dialog and the list below it. Writes go through
// server/actions/budgets.ts.
export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const rawParams = await searchParams;
  const month = toSingle(rawParams.month) ?? currentMonthKey();

  const [budgets, categories, currency] = await Promise.all([
    listBudgetsWithProgress({ month }),
    listCategories(),
    getCurrentUserCurrency(),
  ]);

  // A category already budgeted this month is excluded from the create
  // dropdown -- proactive UX; the database's unique constraint is the real
  // enforcement (see server/data/budgets.ts's createBudget).
  const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId));
  const availableCategories = filterAvailableBudgetCategories(categories, budgetedCategoryIds);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <BudgetsBoard budgets={budgets} availableCategories={availableCategories} month={month} currency={currency} />
    </div>
  );
}
