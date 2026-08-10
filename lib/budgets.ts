import type { CategoryDTO } from "@/server/data/categories";
import type { BudgetProgressDTO } from "@/server/data/budgets";

// Pure, dependency-free -- same convention as lib/money.ts / lib/dates.ts.
// Extracted out of app/(dashboard)/budgets/page.tsx so this rule (which
// categories a NEW budget can target) is unit-testable directly, rather
// than only exercisable by rendering the async Server Component page.
//
// The `CategoryDTO` import is type-only and erased at compile time, so this
// stays free of any real dependency on server/** -- consistent with
// components already importing DTO types from server/data/* (e.g.
// DashboardSummaryCards importing DashboardSummaryDTO).
export function filterAvailableBudgetCategories(
  categories: CategoryDTO[],
  budgetedCategoryIds: ReadonlySet<string>,
): CategoryDTO[] {
  return categories.filter((c) => c.type === "EXPENSE" && !budgetedCategoryIds.has(c.id));
}

export interface BudgetProgress {
  remainingCents: number;
  percentUsed: number;
  isOverBudget: boolean;
}

/**
 * The spent-vs-budget math, extracted out of server/data/budgets.ts so both
 * the DAL and the client's optimistic-update draft builder
 * (components/budgets/BudgetForm.tsx) compute it identically -- an edit
 * that changes amountCents can be optimistically reflected with fully
 * correct progress numbers (spentCents is already known from the existing
 * row), not an approximation, because it's the exact same formula.
 */
export function computeBudgetProgress(amountCents: number, spentCents: number): BudgetProgress {
  const remainingCents = amountCents - spentCents;
  // Guarded the same way the dashboard's savings rate is: a zero budget
  // with zero spend is 0%, not NaN; any spend against a zero budget caps
  // the *display* percent at 100 rather than showing Infinity, while
  // isOverBudget is computed from the raw cents, unaffected by the cap.
  const percentUsed = amountCents > 0 ? Math.round((spentCents / amountCents) * 100) : spentCents > 0 ? 100 : 0;
  return { remainingCents, percentUsed, isOverBudget: spentCents > amountCents };
}

export type BudgetOptimisticAction =
  | { type: "add"; budget: BudgetProgressDTO }
  | { type: "update"; id: string; patch: Partial<BudgetProgressDTO> }
  | { type: "remove"; id: string };

/**
 * Pure reducer for the useOptimistic overlay in components/budgets/BudgetsBoard.tsx
 * -- kept here, not inline, so the add/update/remove logic (including the
 * re-sort-by-percentUsed that keeps an optimistic add in the same order
 * server/data/budgets.ts's listBudgetsWithProgress returns) is unit-testable
 * without rendering anything.
 */
export function budgetOptimisticReducer(
  state: BudgetProgressDTO[],
  action: BudgetOptimisticAction,
): BudgetProgressDTO[] {
  switch (action.type) {
    case "add":
      return [...state, action.budget].sort((a, b) => b.percentUsed - a.percentUsed);
    case "update":
      return state.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b));
    case "remove":
      return state.filter((b) => b.id !== action.id);
  }
}
