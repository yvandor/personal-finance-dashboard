"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { CategoryDTO } from "@/server/data/categories";

interface TransactionFiltersProps {
  categories: CategoryDTO[];
}

const FILTER_KEYS = ["type", "categoryId", "dateFrom", "dateTo", "q"] as const;

export function TransactionFilters({ categories }: TransactionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("skip"); // any filter change starts back at page 1
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  function handleSearchChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("q", value), 400);
  }

  const activeFilterCount = FILTER_KEYS.filter((key) => searchParams.get(key)).length;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="min-w-[180px] flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">
          Search
        </label>
        <input
          id="q"
          type="search"
          value={q}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search descriptions…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="type" className="mb-1 block text-xs font-medium text-muted">
          Type
        </label>
        <select
          id="type"
          value={searchParams.get("type") ?? ""}
          onChange={(e) => updateParam("type", e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">All</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
      </div>

      <div>
        <label htmlFor="categoryId" className="mb-1 block text-xs font-medium text-muted">
          Category
        </label>
        <select
          id="categoryId"
          value={searchParams.get("categoryId") ?? ""}
          onChange={(e) => updateParam("categoryId", e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="dateFrom" className="mb-1 block text-xs font-medium text-muted">
          From
        </label>
        <input
          id="dateFrom"
          type="date"
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => updateParam("dateFrom", e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="dateTo" className="mb-1 block text-xs font-medium text-muted">
          To
        </label>
        <input
          id="dateTo"
          type="date"
          value={searchParams.get("dateTo") ?? ""}
          onChange={(e) => updateParam("dateTo", e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-accent hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
