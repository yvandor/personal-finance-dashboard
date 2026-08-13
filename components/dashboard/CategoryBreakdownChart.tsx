"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCents } from "@/lib/money";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import type { CategoryBreakdownItemDTO } from "@/server/data/dashboard";

const SLICE_COLORS = [
  "var(--color-accent)",
  "var(--color-expense)",
  "#f59e0b",
  "#0ea5e9",
  "#a855f7",
  "#14b8a6",
  "var(--color-muted)", // "Other" bucket, when present -- deliberately neutral
];

interface CategoryBreakdownChartProps {
  data: CategoryBreakdownItemDTO[];
  currency?: string;
}

// Paired with a plain text list of the same figures -- see TrendChart's
// comment: chart meaning must never be color-only, and the list (not the
// chart SVG) is what component tests assert against.
export function CategoryBreakdownChart({ data, currency }: CategoryBreakdownChartProps) {
  const total = data.reduce((sum, item) => sum + item.totalCents, 0);

  return (
    <section aria-labelledby="category-chart-heading" className="rounded-xl border border-border bg-surface p-4">
      <h2 id="category-chart-heading" className="text-sm font-medium">
        Expenses by category
      </h2>

      {data.length === 0 ? (
        <p className="mt-4 py-8 text-center text-sm text-muted">No expenses in this period yet.</p>
      ) : (
        <>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer>
                <Pie
                  data={data}
                  dataKey="totalCents"
                  nameKey="categoryName"
                  innerRadius="55%"
                  outerRadius="80%"
                >
                  {data.map((item, index) => (
                    <Cell key={item.categoryName} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCents(Number(value), currency)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Text fallback for the pie above -- load-bearing for accessibility
              (chart meaning must never be color-only, and this is also what
              component tests assert against, see the comment at the top of
              this file). Each row's dot color comes from the same
              SLICE_COLORS[index] mapping as the Pie's Cell -- category
              breakdown rows have no per-category `color` field of their own
              (unlike RecentTransactions/CategoryList, which use the real
              user-picked category color), so this stays in sync with the
              chart rather than introducing a second, unrelated color source. */}
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            {data.map((item, index) => (
              <li key={item.categoryName} className="flex items-center justify-between gap-2">
                <CategoryBadge
                  name={item.categoryName}
                  color={SLICE_COLORS[index % SLICE_COLORS.length]}
                  className="min-w-0 flex-1"
                />
                <span className="shrink-0 tabular-nums">
                  {formatCents(item.totalCents, currency)}
                  {total > 0 && (
                    <span className="ml-1 text-muted">({Math.round((item.totalCents / total) * 100)}%)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
