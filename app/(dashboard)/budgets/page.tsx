import { listBudgetsWithProgress } from "@/server/data/budgets";
import { listCategories } from "@/server/data/categories";
import { getCurrentUserCurrency } from "@/server/data/users";
import { currentMonthKey } from "@/lib/dates";
import { filterAvailableBudgetCategories } from "@/lib/budgets";
import { MonthSelector } from "@/components/budgets/MonthSelector";
import { BudgetList } from "@/components/budgets/BudgetList";
import { BudgetFormDialog } from "@/components/budgets/BudgetFormDialog";

type SearchParams = Record<string, string | string[] | undefined>;

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90";

// A Server Component: reads searchParams, calls the DAL directly (no
// Server Action needed for a read), and composes presentational
// components. Writes go through server/actions/budgets.ts instead.
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Budgets</h1>
          <p className="text-sm text-muted">Set monthly limits per category and track spending against them.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector month={month} />
          <BudgetFormDialog
            mode="create"
            categories={availableCategories}
            month={month}
            triggerClassName={PRIMARY_BUTTON_CLASSES}
          >
            Add budget
          </BudgetFormDialog>
        </div>
      </div>

      <BudgetList budgets={budgets} currency={currency} />
    </div>
  );
}
