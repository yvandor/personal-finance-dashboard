import { listCategoriesForManagement } from "@/server/data/categories";
import { CategoriesBoard } from "@/components/categories/CategoriesBoard";

// A Server Component: reads directly through the DAL, no Server Action
// needed for the read itself. Hands the results to CategoriesBoard (a
// client component), which owns the useOptimistic overlay shared by the
// header's create dialog and the list below it. Writes go through
// server/actions/categories.ts.
export default async function CategoriesPage() {
  const categories = await listCategoriesForManagement();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <CategoriesBoard categories={categories} />
    </div>
  );
}
