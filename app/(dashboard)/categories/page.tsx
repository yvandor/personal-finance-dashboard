import { listCategoriesForManagement } from "@/server/data/categories";
import { CategoriesBoard } from "@/components/categories/CategoriesBoard";

// A Server Component: reads directly through the DAL, no Server Action
// needed for the read itself. Hands the results to CategoriesBoard (a
// client component), which owns the useOptimistic overlay shared by the
// header's create dialog and the list below it. Writes go through
// server/actions/categories.ts.
//
// force-dynamic (v1.4): this page uses no dynamic API (no cookies/headers/
// searchParams), so Next statically prerendered it at build time -- which
// meant it was served with `Cache-Control: s-maxage=31536000` (one year) on
// a real production server, despite reading live per-user category data.
// Found via a real production-server header check, not assumed. Forces
// per-request rendering so this gets the same `private, no-store` treatment
// /transactions and /budgets already have (those pages read searchParams,
// which already makes them dynamic without needing this directive).
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategoriesForManagement();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <CategoriesBoard categories={categories} />
    </div>
  );
}
