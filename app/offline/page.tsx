// The offline fallback page. public/sw.js's fetch handler serves this page
// (from cache, precached at install time) only when a navigation request's
// real network fetch fails -- see lib/sw-strategy.ts's module comment for
// the full caching-safety rationale.
//
// SAFETY-CRITICAL: this page must never show a financial figure of any
// kind -- no cached balance, no cached transaction, nothing that could read
// as "current" data while actually being stale or absent. It renders no
// props, fetches no data, and reads nothing from any store; it is static on
// purpose so there is nothing here that could ever go stale.
//
// No loading.tsx/error.tsx: this page has no data fetching (nothing to
// suspend on, nothing that can throw), so neither would ever render.
export default function OfflinePage() {
  return (
    // flex-1 fills app/layout.tsx's `min-h-full flex flex-col` body, so the
    // card sits optically centred at any viewport height without a magic
    // min-h-[60vh]. Only the top inset is folded in (in one declaration, per
    // app/globals.css's note on why a bare .pt-safe can't stack on py-*):
    // this route is outside app/(dashboard), so BottomNav never renders over
    // it and there is nothing to clear at the bottom.
    <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-[calc(var(--safe-area-top)+4rem)]">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-surface px-6 py-10 text-center">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 3 18 18" />
            <path d="M9.5 9.1A4.5 4.5 0 0 0 7 18h9" />
            <path d="M19.7 15.3A4 4 0 0 0 17 8.4a6 6 0 0 0-5.4-3.4" />
          </svg>
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">You&rsquo;re offline</h1>
          <p className="text-sm text-muted">
            This page is the only one saved on your device. Everything else loads again once
            you&rsquo;re back online.
          </p>
        </div>
      </div>
    </main>
  );
}
