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
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">You&rsquo;re offline</h1>
      <p className="text-sm text-muted">
        Your data will resume loading once you&rsquo;re back online.
      </p>
    </div>
  );
}
