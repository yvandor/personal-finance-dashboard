// Pure caching-decision logic for the service worker's fetch handler
// (public/sw.js). Kept here, not inline in sw.js, so this is unit-testable
// without a browser or ServiceWorker context -- same discipline this
// codebase already uses everywhere else (lib/budgets.ts's
// computeBudgetProgress, lib/recurringBills.ts's computeBillStatus).
//
// SAFETY-CRITICAL, read before changing: this is a finance app, and serving
// a stale cached page (a wrong balance) is a worse failure than any other
// bug in this codebase. The classification below is therefore
// default-safe -- anything not explicitly recognized as a content-hashed,
// non-financial static asset falls through to "network-only". Never widen
// the "static" branch to a pattern-based guess (e.g. "anything under
// /api-ish-looking paths" or "anything without a file extension"); only add
// a new "static" case for a path this app's own build emits and that is
// provably immutable/non-financial, and say why in a comment when you do.
//
// public/sw.js is a plain browser script, not bundled by Next or Vite, so
// it cannot `import` this module -- it keeps a hand-written duplicate of
// this exact function, cross-referencing this file in a comment. If you
// change the rules here, update public/sw.js's copy in the same commit;
// tests/unit/sw-strategy.test.ts only exercises this file, not sw.js, so
// nothing will fail loudly if the two drift apart.
export type CacheStrategy = "static" | "network-only";

/**
 * Classifies a request URL for the service worker's fetch handler.
 *
 * - "static": safe to cache-first. Limited to Next's content-hashed build
 *   assets (`/_next/static/*` -- the hash changes on every deploy, so a
 *   stale cache entry for an old hash is simply never requested again) plus
 *   this app's own generated icon/manifest routes (versioned by this app's
 *   deploys, never contain financial figures).
 * - "network-only": everything else, including every navigation request
 *   (any HTML document -- `/`, `/dashboard`, `/transactions`, etc.) and any
 *   path this function doesn't specifically recognize. No stale-while-
 *   revalidate, no network-falling-back-to-cache -- a failed network
 *   request for a network-only path is a failure, full stop; the service
 *   worker's fetch handler is responsible for turning that failure into the
 *   offline fallback page for navigations, not this function.
 */
export function classifyRequest(url: string): CacheStrategy {
  const path = extractPath(url);
  if (path === null) return "network-only";

  if (path.startsWith("/_next/static/")) return "static";

  // app/manifest.ts's emitted route.
  if (path === "/manifest.webmanifest") return "static";

  // app/icon.tsx / app/apple-icon.tsx's emitted routes. Matched by prefix
  // (not exact-equals) because Next's file-convention icon routes can carry
  // a cache-busting query string and, when a route uses
  // generateImageMetadata for multiple sizes, an /icon/<id>-shaped path --
  // both still point at build-time-generated, non-financial image bytes.
  if (path === "/icon" || path.startsWith("/icon/")) return "static";
  if (path === "/apple-icon" || path.startsWith("/apple-icon/")) return "static";
  if (path === "/favicon.ico") return "static";

  // app/icon-maskable/route.tsx's emitted route -- a plain custom Route
  // Handler, deliberately NOT under the /icon/ prefix above (see that
  // route's own header for why: it used to be a generateImageMetadata id of
  // app/icon.tsx, moved out to its own independent route after a real
  // Next.js concurrency bug corrupted responses when two ids of that same
  // array were requested at once). Still build-time-generated,
  // non-financial image bytes -- exact match only, this route takes no id.
  if (path === "/icon-maskable") return "static";

  return "network-only";
}

// Accepts either an absolute URL or a bare path so callers (sw.js passes
// `event.request.url`, tests pass bare paths) don't each need their own
// parsing. Returns null for a string URL() can't parse at all, which
// classifyRequest treats as "network-only" -- default-safe.
function extractPath(url: string): string | null {
  if (url.startsWith("/")) return url.split("?")[0].split("#")[0];
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}
