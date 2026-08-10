import { CategoryFormDialog } from "./CategoryFormDialog";
import { ArchiveCategoryButton } from "./ArchiveCategoryButton";
import type { CategoryManagementDTO } from "@/server/data/categories";

interface CategoryRowProps {
  category: CategoryManagementDTO;
  onOptimisticUpdate?: (id: string, patch: Partial<CategoryManagementDTO>) => void;
}

export function CategoryRow({ category, onOptimisticUpdate }: CategoryRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: category.color }}
        />
        <div className="min-w-0">
          <p className="truncate font-medium">
            {category.name}
            {category.isSystem && <span className="ml-2 text-xs font-normal text-muted">Default</span>}
          </p>
          <p className="text-sm text-muted">
            {category.transactionCount === 0
              ? "Not currently in use"
              : `${category.transactionCount} transaction${category.transactionCount === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!category.isArchived && (
          <CategoryFormDialog
            mode="edit"
            category={category}
            triggerClassName="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-accent"
            triggerAriaLabel={`Edit ${category.name}`}
            onOptimisticUpdate={onOptimisticUpdate}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </CategoryFormDialog>
        )}
        <ArchiveCategoryButton
          id={category.id}
          name={category.name}
          isArchived={category.isArchived}
          transactionCount={category.transactionCount}
          onOptimisticUpdate={onOptimisticUpdate}
        />
      </div>
    </div>
  );
}
