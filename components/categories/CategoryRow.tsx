import { CategoryFormDialog } from "./CategoryFormDialog";
import { ArchiveCategoryButton } from "./ArchiveCategoryButton";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import type { CategoryManagementDTO } from "@/server/data/categories";

interface CategoryRowProps {
  category: CategoryManagementDTO;
  onOptimisticUpdate?: (id: string, patch: Partial<CategoryManagementDTO>) => void;
}

export function CategoryRow({ category, onOptimisticUpdate }: CategoryRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">
          <CategoryBadge name={category.name} color={category.color} />
          {category.isSystem && <span className="ml-2 text-xs font-normal text-muted">Default</span>}
        </p>
        <p className="text-sm text-muted">
          {category.transactionCount === 0
            ? "Not currently in use"
            : `${category.transactionCount} transaction${category.transactionCount === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!category.isArchived && (
          <CategoryFormDialog
            mode="edit"
            category={category}
            triggerClassName="inline-flex size-11 items-center justify-center rounded-md text-muted outline-none transition-colors hover:bg-surface-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
