// The canonical set of categories a brand-new user starts with. Single
// source of truth consumed by server/data/categories.ts's
// seedDefaultCategories (real onboarding, via Auth.js's events.createUser),
// scripts/backfill-default-categories.ts (one-time backfill for existing
// zero-category users), and prisma/seed.ts (local dev) -- so dev, backfill,
// and real signup never drift into three different "default" lists.
//
// Pure, dependency-free data -- same convention as lib/money.ts/lib/dates.ts
// and lib/schemas/category.ts's own literal type (not importing the
// generated Prisma enum) -- testable and importable from anywhere,
// including standalone scripts, without pulling in Prisma or server-only.
//
// sortOrder is 0-indexed within each type (not across the whole list) --
// categories.ts's listCategories() orders by [type, sortOrder, name], so
// only the within-type position matters.
export interface DefaultCategory {
  name: string;
  type: "INCOME" | "EXPENSE";
  sortOrder: number;
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Housing", type: "EXPENSE", sortOrder: 0 },
  { name: "Food & Dining", type: "EXPENSE", sortOrder: 1 },
  { name: "Transportation", type: "EXPENSE", sortOrder: 2 },
  { name: "Bills & Utilities", type: "EXPENSE", sortOrder: 3 },
  { name: "Shopping", type: "EXPENSE", sortOrder: 4 },
  { name: "Entertainment", type: "EXPENSE", sortOrder: 5 },
  { name: "Health", type: "EXPENSE", sortOrder: 6 },
  { name: "Personal", type: "EXPENSE", sortOrder: 7 },
  { name: "Other", type: "EXPENSE", sortOrder: 8 },
  { name: "Paycheck", type: "INCOME", sortOrder: 0 },
  { name: "Freelance", type: "INCOME", sortOrder: 1 },
  { name: "Investments", type: "INCOME", sortOrder: 2 },
  { name: "Other Income", type: "INCOME", sortOrder: 3 },
];
