"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MONTHS_BACK_OPTIONS = [
  { value: 3, label: "Last 3 months" },
  { value: 6, label: "Last 6 months" },
  { value: 12, label: "Last 12 months" },
];

// Same URL-driven pattern as components/dashboard/PeriodSelector.tsx: the
// select's value lives in the URL, not component state, so it survives a
// refresh and is shareable/linkable, and "re-fetching" is just the Server
// Component page re-rendering for the new searchParams -- no client-side
// data fetching, no useOptimistic wrapper (there's nothing to optimistically
// update on a read-only page).
export function MonthsBackSelector({ monthsBack }: { monthsBack: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("monthsBack", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="history-months-back" className="text-sm font-medium text-muted">
        Show
      </label>
      <select
        id="history-months-back"
        value={monthsBack}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-base focus:border-accent focus:outline-none"
      >
        {MONTHS_BACK_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
