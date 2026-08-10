import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { monthKeyRange } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { MonthlyHistoryDTO } from "@/server/data/history";

const monthLabelFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

function formatMonthLabel(monthKey: string): string {
  return monthLabelFormat.format(new Date(`${monthKey}-01T00:00:00Z`));
}

// /transactions has no `month` filter of its own (see
// lib/schemas/transaction.ts's transactionFilterSchema) -- the equivalent
// drill-down is the same month expressed as its inclusive date bounds,
// which the page's existing dateFrom/dateTo filters already understand.
function transactionsHrefForMonth(month: string): string {
  const { start, end } = monthKeyRange(month);
  return `/transactions?dateFrom=${start}&dateTo=${end}`;
}

function budgetsHrefForMonth(month: string): string {
  return `/budgets?month=${month}`;
}

interface HistoryTableProps {
  history: MonthlyHistoryDTO[];
  currency?: string;
}

// Same dual desktop-table / mobile-card-list pattern as
// components/transactions/TransactionList.tsx -- a month label plus six
// data columns doesn't fit a 375px viewport as a table, so this renders
// both trees (one CSS-hidden per breakpoint) rather than a later
// mobile-audit patch.
export function HistoryTable({ history, currency }: HistoryTableProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-4 py-16 text-center">
        <p className="text-sm font-medium">No history yet</p>
        <p className="text-sm text-muted">Come back after your first month of activity.</p>
      </div>
    );
  }

  return (
    <>
      <table className="hidden w-full text-left md:table">
        <caption className="sr-only">Month-to-month income, expenses, budgets, and bills</caption>
        <thead>
          <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted">
            <th scope="col" className="px-4 py-3 font-medium">
              Month
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Income
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Expenses
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Net
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Budgeted
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Spent
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Bills paid
            </th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => (
            <tr key={row.month} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{formatMonthLabel(row.month)}</td>
              <td className="px-4 py-3 text-right">
                <Link href={transactionsHrefForMonth(row.month)} className="hover:underline">
                  <Money cents={row.incomeCents} currency={currency} />
                </Link>
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={transactionsHrefForMonth(row.month)} className="hover:underline">
                  <Money cents={-row.expenseCents} currency={currency} />
                </Link>
              </td>
              <td className="px-4 py-3 text-right">
                <Money cents={row.netCents} currency={currency} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                <Link href={budgetsHrefForMonth(row.month)} className="hover:underline">
                  {formatCents(row.totalBudgetedCents, currency)}
                </Link>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                <Link href={budgetsHrefForMonth(row.month)} className="hover:underline">
                  {formatCents(row.totalSpentCents, currency)}
                </Link>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.billsPaidCount} of {row.billsTotalCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="md:hidden">
        {history.map((row) => (
          <div key={row.month} className="border-b border-border p-4 last:border-0">
            <p className="font-medium">{formatMonthLabel(row.month)}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Income</dt>
                <dd>
                  <Link href={transactionsHrefForMonth(row.month)} className="hover:underline">
                    <Money cents={row.incomeCents} currency={currency} />
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Expenses</dt>
                <dd>
                  <Link href={transactionsHrefForMonth(row.month)} className="hover:underline">
                    <Money cents={-row.expenseCents} currency={currency} />
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Net</dt>
                <dd>
                  <Money cents={row.netCents} currency={currency} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Bills paid</dt>
                <dd className="tabular-nums">
                  {row.billsPaidCount} of {row.billsTotalCount}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted">Budget</dt>
                <dd className="tabular-nums">
                  <Link href={budgetsHrefForMonth(row.month)} className="hover:underline">
                    {formatCents(row.totalSpentCents, currency)} of {formatCents(row.totalBudgetedCents, currency)}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
