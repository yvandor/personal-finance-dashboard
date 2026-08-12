// Service worker for the installable-PWA slice (v1.4). Two jobs, nothing
// else:
//   1. Cache-first for Next's content-hashed static assets plus this app's
//      generated icon/manifest routes (see classifyRequest below).
//   2. Serve /offline (precached) when a navigation request's real network
//      fetch fails.
//
// SAFETY-CRITICAL -- read this file's classifyRequest comment and
// lib/sw-strategy.ts's module comment before changing anything here. This
// is a finance app: a caching bug that shows a stale/wrong balance is the
// worst possible failure mode in this codebase, worse than any other bug.
//
// No Background Sync, no request queueing for POSTs/Server Actions -- a
// failed mutation fails immediately and visibly, exactly as it does today
// (server/actions/*'s ActionResult error handling already does this
// correctly). This service worker never intercepts a non-GET request (see
// the fetch handler's method guard below), so it cannot change that
// behavior even by accident.

// Manually bumped, not derived from a build-time timestamp: public/sw.js is
// served as a plain static file -- Next copies public/* verbatim, this
// file is never bundled, transformed, or otherwise touched by the build --
// so there's no build artifact to read a per-deploy value from without
// adding a dedicated build step (e.g. a small script to stamp a timestamp
// in before `next build` runs), which is more infrastructure than this
// slice needs. Bump this by hand any time the cached-asset behavior below
// changes. Safety net if someone forgets: the `activate` handler deletes
// every previously-cached name that doesn't match CACHE_NAME, so a stale
// SW from a prior deploy can never keep serving assets out of an orphaned
// cache indefinitely -- worst case with a forgotten bump is one extra
// deploy cycle before the *next* bump clears things out, never "forever."
const CACHE_VERSION = "v1";
const CACHE_NAME = `finance-dashboard-static-${CACHE_VERSION}`;

// Precached at install time: only the offline fallback page and the
// manifest, both needed the moment install completes so a first-ever
// offline visit has something to fall back to. _next/static/* assets are
// deliberately NOT precached here (their content-hashed filenames aren't
// knowable from this static script); they get cached opportunistically the
// first time each one is actually requested, via cacheFirst() below.
//
// The icon/apple-icon routes (v1.4-v1.6) used to be listed here too, and
// were removed after a real, CI-reproduced bug: cache.addAll() below fires
// every PRECACHE_URLS fetch concurrently, racing against the page's own
// burst of asset requests at the busiest possible moment (right after
// install, on the very first navigation) -- and in that specific window,
// requests for the generated icon routes intermittently came back with an
// empty body (confirmed via e2e/pwa-production.spec.ts's CI failures and
// their network traces: correct image/png headers, zero content bytes).
// Every attempt to reproduce it against an on-demand fetch -- sequential,
// concurrent, cold server, warm server -- succeeded every time; only the
// install-time addAll() stampede ever produced the corrupted response,
// which points at request/connection contention during install rather than
// anything wrong with the icon routes' own rendering (confirmed separately:
// the same routes decode correctly on every direct, non-precache fetch).
// Dropping them from PRECACHE_URLS removes that contention entirely --
// classifyRequest() below still classifies `/icon/*` and `/apple-icon` as
// "static", so cacheFirst() still caches each one the first time a page
// actually requests it, same end state, just reached lazily instead of in
// a forced burst at the worst possible time.
const PRECACHE_URLS = ["/offline", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// KEEP IN EXACT SYNC WITH lib/sw-strategy.ts's `classifyRequest`.
//
// This file is a plain browser script -- not a module Vitest or Next's
// bundler processes -- so it cannot `import` that function the way test
// files reach it via the "@/lib/..." path alias. tests/unit/sw-strategy.test.ts
// is the tested source of truth for this decision logic; this copy has no
// test coverage of its own and will NOT fail loudly if it drifts from the
// original. Any change to lib/sw-strategy.ts's classifyRequest must be
// mirrored here in the same commit.
function classifyRequest(url) {
  let path;
  if (url.startsWith("/")) {
    path = url.split("?")[0].split("#")[0];
  } else {
    try {
      path = new URL(url).pathname;
    } catch {
      return "network-only";
    }
  }

  if (path.startsWith("/_next/static/")) return "static";
  if (path === "/manifest.webmanifest") return "static";
  if (path === "/icon" || path.startsWith("/icon/")) return "static";
  if (path === "/apple-icon" || path.startsWith("/apple-icon/")) return "static";
  if (path === "/favicon.ico") return "static";
  return "network-only";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only ever intercept GET. POSTs (Server Actions, form submissions) pass
  // straight through untouched -- no queueing, no offline handling. This is
  // the guarantee this file's module comment promises.
  if (request.method !== "GET") return;

  const strategy = classifyRequest(request.url);

  if (strategy === "static") {
    event.respondWith(cacheFirst(request));
    return;
  }

  // strategy === "network-only" from here down.
  //
  // Navigation requests (a real document load/reload, not a client-side
  // route transition) are the one case that gets a fallback -- and it is a
  // fallback to a dedicated static offline page, never to a cached copy of
  // the page that was actually requested. That distinction is the whole
  // safety requirement: this must never risk resurrecting a stale balance
  // or transaction list from cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline").then((cached) => cached || Response.error())),
    );
    return;
  }

  // Every other network-only request (in-page fetches, RSC payload
  // requests for client-side transitions, anything unrecognized) is left
  // completely un-intercepted -- no event.respondWith() call at all -- so
  // the browser handles it exactly as if this service worker didn't exist:
  // straight to the network, and a real failure on a real failure.
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Only cache genuinely successful, same-origin ("basic") responses --
  // never an error response or an opaque cross-origin one, under a URL a
  // later request might match against.
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone());
  }
  return response;
}
