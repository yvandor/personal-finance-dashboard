"use client";

import { useOptimistic } from "react";
import { categoryOptimisticReducer } from "@/lib/categories";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { CategoryList } from "./CategoryList";
import type { CategoryManagementDTO } from "@/server/data/categories";

interface CategoriesBoardProps {
  categories: CategoryManagementDTO[];
}

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90";

// Owns the useOptimistic overlay so the header's "Add category" trigger and
// the list below it share one optimistic array -- same shape as
// components/budgets/BudgetsBoard.tsx.
export function CategoriesBoard({ categories }: CategoriesBoardProps) {
  const [optimisticCategories, dispatch] = useOptimistic(categories, categoryOptimisticReducer);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted">
            Organize income and expenses. Archiving hides a category from new entries without touching its history.
          </p>
        </div>
        <CategoryFormDialog
          mode="create"
          triggerClassName={PRIMARY_BUTTON_CLASSES}
          onOptimisticAdd={(category) => dispatch({ type: "add", category })}
        >
          Add category
        </CategoryFormDialog>
      </div>

      <CategoryList
        categories={optimisticCategories}
        onOptimisticUpdate={(id, patch) => dispatch({ type: "update", id, patch })}
      />
    </>
  );
}
