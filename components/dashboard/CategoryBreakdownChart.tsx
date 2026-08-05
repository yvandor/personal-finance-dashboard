"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCents } from "@/lib/money";
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
      <h2 id="category-chart-heading" className="text-sm font-semibold">
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

          <ul className="mt-4 space-y-1.5 text-sm">
            {data.map((item, index) => (
              <li key={item.categoryName} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
                  />
                  {item.categoryName}
                </span>
                <span className="tabular-nums">
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
