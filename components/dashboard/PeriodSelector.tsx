"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DashboardPeriod } from "@/lib/dates";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "current-month", label: "Current month" },
  { value: "last-3-months", label: "Last 3 months" },
  { value: "last-6-months", label: "Last 6 months" },
  { value: "current-year", label: "Current year" },
];

// Same URL-driven pattern as TransactionFilters: the select's value lives in
// the URL, not component state, so the period survives a refresh and is
// shareable/linkable, and re-fetching data is just the Server Component
// page re-rendering for the new searchParams -- no client-side data
// fetching to wire up here.
export function PeriodSelector({ period }: { period: DashboardPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="dashboard-period" className="text-sm font-medium text-muted">
        Period
      </label>
      <select
        id="dashboard-period"
        value={period}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
      >
        {PERIOD_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
