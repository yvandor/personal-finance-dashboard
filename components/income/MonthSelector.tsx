"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { shiftMonthKey } from "@/lib/dates";

const monthLabelFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function formatMonthLabel(monthKey: string): string {
  return monthLabelFormat.format(new Date(`${monthKey}-01T00:00:00Z`));
}

// URL-driven, same pattern as components/budgets/MonthSelector.tsx (a
// small, local copy rather than a shared import -- components/budgets/**
// is another agent's territory this version, see docs/PROJECT_PLAN.md's
// v1.3 worktree split). The month lives in `?month=`, not component state,
// so it survives a refresh and is linkable.
export function MonthSelector({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(newMonth: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonth);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(shiftMonthKey(month, -1))}
        aria-label="Previous month"
        className="rounded-lg border border-border p-2 hover:bg-surface-hover"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="min-w-32 text-center text-sm font-medium">{formatMonthLabel(month)}</span>
      <button
        type="button"
        onClick={() => go(shiftMonthKey(month, 1))}
        aria-label="Next month"
        className="rounded-lg border border-border p-2 hover:bg-surface-hover"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
