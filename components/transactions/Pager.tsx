import Link from "next/link";

interface PagerProps {
  take: number;
  skip: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}

function buildHref(searchParams: Record<string, string | undefined>, skip: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "skip") params.set(key, value);
  }
  if (skip > 0) params.set("skip", String(skip));
  const query = params.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

// Server-rendered prev/next links driven by the take/skip already supported
// by listTransactions() -- no client-side pagination state to keep in sync.
export function Pager({ take, skip, total, searchParams }: PagerProps) {
  if (total === 0) return null;

  const hasPrev = skip > 0;
  const hasNext = skip + take < total;
  const start = skip + 1;
  const end = Math.min(skip + take, total);

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
      <span>
        Showing {start}–{end} of {total}
      </span>
      <nav className="flex gap-2" aria-label="Pagination">
        {hasPrev ? (
          <Link
            href={buildHref(searchParams, Math.max(0, skip - take))}
            className="rounded-lg border border-border px-3 py-1.5 hover:bg-surface-hover"
          >
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className="rounded-lg border border-border px-3 py-1.5 opacity-40">
            Previous
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(searchParams, skip + take)}
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
