import { CategoryRow } from "./CategoryRow";
import type { CategoryManagementDTO } from "@/server/data/categories";

interface CategoryListProps {
  categories: CategoryManagementDTO[];
}

function Section({ title, items }: { title: string; items: CategoryManagementDTO[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-muted">{title}</h2>
      <div className="space-y-2">
        {items.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </div>
    </div>
  );
}

// Grouped by type (active only) then a separate Archived section -- mirrors
// how the transaction/budget forms already type-scope their pickers, and
// keeps archived categories visually de-emphasized without hiding them
// (they're still real history, just not offered for new entries).
export function CategoryList({ categories }: CategoryListProps) {
  const active = categories.filter((c) => !c.isArchived);
  const archived = categories.filter((c) => c.isArchived);
  const income = active.filter((c) => c.type === "INCOME");
  const expense = active.filter((c) => c.type === "EXPENSE");

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-4 py-16 text-center">
        <p className="text-sm font-medium">No categories yet</p>
        <p className="text-sm text-muted">Add a category to start classifying transactions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Income categories" items={income} />
      <Section title="Expense categories" items={expense} />
      <Section title="Archived" items={archived} />
    </div>
  );
}
