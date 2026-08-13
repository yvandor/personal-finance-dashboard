"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents } from "@/lib/money";
import type { MonthlyTrendPointDTO } from "@/server/data/dashboard";

const monthLabelFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function formatMonthLabel(monthKey: string): string {
  return monthLabelFormat.format(new Date(`${monthKey}-01T00:00:00Z`));
}

interface TrendChartProps {
  data: MonthlyTrendPointDTO[];
  currency?: string;
}

// Paired with a plain text table of the same numbers underneath the chart:
// chart meaning must never be color-only (see docs/PROJECT_PLAN.md's
// accessibility section), and a screen-reader user can't perceive an SVG
// bar chart's shapes at all. The table is also what component tests assert
// against, since Recharts' ResponsiveContainer measures a real layout size
// that jsdom doesn't provide -- the SVG itself is unreliable to test.
export function TrendChart({ data, currency }: TrendChartProps) {
  const hasData = data.some((point) => point.incomeCents !== 0 || point.expenseCents !== 0);

  return (
    <section aria-labelledby="trend-chart-heading" className="rounded-xl border border-border bg-surface p-4">
      <h2 id="trend-chart-heading" className="text-sm font-medium">
        Income vs. expenses by month
      </h2>

      {!hasData ? (
        <p className="mt-4 py-8 text-center text-sm text-muted">No transactions in this period yet.</p>
      ) : (
        <>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(cents: number) => formatCents(cents, currency)} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCents(Number(value), currency)}
                  labelFormatter={(label) => (typeof label === "string" ? formatMonthLabel(label) : String(label))}
                />
                <Legend />
                <Bar dataKey="incomeCents" name="Income" fill="var(--color-income)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenseCents" name="Expenses" fill="var(--color-expense)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">Income and expenses by month, in full</caption>
            <thead>
              <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted">
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  Month
                </th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">
                  Income
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Expenses
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.month} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-2 text-muted">{formatMonthLabel(point.month)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-income">
                    {formatCents(point.incomeCents, currency)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-expense">
                    {formatCents(point.expenseCents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
