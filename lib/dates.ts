// Pure date-range math for the dashboard's selectable reporting periods.
// Kept dependency-free and DB-free specifically so it's unit-testable with
// an injected `now` -- "current month"/"current year" are relative to real
// time, and a test that relied on the actual wall clock would pass or fail
// depending on which day it happened to run.
//
// All arithmetic is done in UTC, matching how the rest of the app treats a
// transaction's `date` column: a calendar date, not an instant (see
// server/data/transactions.ts) -- a server running in a non-UTC timezone
// must not shift which month a boundary date falls into.

export type DashboardPeriod = "current-month" | "last-3-months" | "last-6-months" | "current-year";

export interface PeriodRange {
  /** Inclusive, "YYYY-MM-DD". */
  dateFrom: string;
  /** Inclusive, "YYYY-MM-DD". */
  dateTo: string;
  /** Ascending "YYYY-MM" keys, one per month spanned by [dateFrom, dateTo]. */
  monthKeys: string[];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function addMonths(year: number, month0: number, delta: number): { year: number; month0: number } {
  const total = year * 12 + month0 + delta;
  return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 };
}

function lastDayOfMonth(year: number, month0: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function resolvePeriodRange(period: DashboardPeriod, now: Date = new Date()): PeriodRange {
  const year = now.getUTCFullYear();
  const month0 = now.getUTCMonth();

  let start: { year: number; month0: number };
  let end: { year: number; month0: number };

  switch (period) {
    case "current-month":
      start = { year, month0 };
      end = { year, month0 };
      break;
    case "last-3-months":
      start = addMonths(year, month0, -2);
      end = { year, month0 };
      break;
    case "last-6-months":
      start = addMonths(year, month0, -5);
      end = { year, month0 };
      break;
    case "current-year":
      start = { year, month0: 0 };
      end = { year, month0: 11 };
      break;
  }

  const dateFrom = `${start.year}-${pad2(start.month0 + 1)}-01`;
  const dateTo = `${end.year}-${pad2(end.month0 + 1)}-${pad2(lastDayOfMonth(end.year, end.month0))}`;

  const monthKeys: string[] = [];
  let y = start.year;
  let m = start.month0;
  while (y < end.year || (y === end.year && m <= end.month0)) {
    monthKeys.push(`${y}-${pad2(m + 1)}`);
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  return { dateFrom, dateTo, monthKeys };
}

/** The inclusive [start, end] date-string range covered by a single "YYYY-MM" key. */
export function monthKeyRange(monthKey: string): { start: string; end: string } {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month0 = Number(monthStr) - 1;
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${pad2(lastDayOfMonth(year, month0))}`,
  };
}

/** "YYYY-MM" for the current UTC month -- the default when no month filter is given (e.g. a fresh /budgets load). */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}`;
}

/** "YYYY-MM" shifted by `delta` months (negative for earlier) -- backs the budgets page's prev/next month navigation. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const shifted = addMonths(year, month - 1, delta);
  return `${shifted.year}-${pad2(shifted.month0 + 1)}`;
}
