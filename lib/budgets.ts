import type { CategoryDTO } from "@/server/data/categories";

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
