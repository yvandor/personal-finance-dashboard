import type { CategoryManagementDTO } from "@/server/data/categories";

export type CategoryOptimisticAction =
  | { type: "add"; category: CategoryManagementDTO }
  | { type: "update"; id: string; patch: Partial<CategoryManagementDTO> };

/**
 * Pure reducer for the useOptimistic overlay in
 * components/categories/CategoriesBoard.tsx -- same convention as
 * lib/budgets.ts's budgetOptimisticReducer. No "remove" action: this app
 * never hard-deletes a category (see server/data/categories.ts's comment on
 * archiveCategory) -- archiving is an "update" (isArchived: true), covered
 * by the update case.
 */
export function categoryOptimisticReducer(
  state: CategoryManagementDTO[],
  action: CategoryOptimisticAction,
): CategoryManagementDTO[] {
  switch (action.type) {
    case "add":
      return [...state, action.category];
    case "update":
      return state.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c));
  }
}
