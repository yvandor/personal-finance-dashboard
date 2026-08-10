import { listCategoriesForManagement } from "@/server/data/categories";
import { CategoryList } from "@/components/categories/CategoryList";
import { CategoryFormDialog } from "@/components/categories/CategoryFormDialog";

const PRIMARY_BUTTON_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90";

// A Server Component: reads directly through the DAL, no Server Action
// needed for the read itself. Writes go through server/actions/categories.ts.
export default async function CategoriesPage() {
  const categories = await listCategoriesForManagement();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted">
            Organize income and expenses. Archiving hides a category from new entries without touching its history.
          </p>
        </div>
        <CategoryFormDialog mode="create" triggerClassName={PRIMARY_BUTTON_CLASSES}>
          Add category
        </CategoryFormDialog>
      </div>

      <CategoryList categories={categories} />
    </div>
  );
}
