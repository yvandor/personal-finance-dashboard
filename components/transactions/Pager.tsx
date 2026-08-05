import Link from "next/link";

interface PagerProps {
  itemsCount: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  searchParams: Record<string, string | undefined>;
}

function buildHref(
  searchParams: Record<string, string | undefined>,
  cursor: string,
  direction: "next" | "prev",
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "cursor" && key !== "direction") params.set(key, value);
  }
  params.set("cursor", cursor);
  params.set("direction", direction);
  return `/transactions?${params.toString()}`;
}

// Cursor-based (keyset) pagination -- see server/data/transactions.ts. There
// is no cheap "page 3 of 12" to show without the same offset-counting
// keyset pagination exists to avoid, so this reports how many of the total
// are on the current page rather than a numeric range.
export function Pager({ itemsCount, total, hasNext, hasPrev, nextCursor, prevCursor, searchParams }: PagerProps) {
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
      <span>
        Showing {itemsCount} of {total}
      </span>
      <nav className="flex gap-2" aria-label="Pagination">
        {hasPrev && prevCursor ? (
          <Link
            href={buildHref(searchParams, prevCursor, "prev")}
            className="rounded-lg border border-border px-3 py-1.5 hover:bg-surface-hover"
          >
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className="rounded-lg border border-border px-3 py-1.5 opacity-40">
            Previous
          </span>
        )}
        {hasNext && nextCursor ? (
          <Link
            href={buildHref(searchParams, nextCursor, "next")}
            className="rounded-lg border border-border px-3 py-1.5 hover:bg-surface-hover"
          >
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className="rounded-lg border border-border px-3 py-1.5 opacity-40">
            Next
          </span>
        )}
      </nav>
    </div>
  );
}
