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
// stay out permanently now (installing shouldn't need to eagerly succeed at
// fetching things a page will fetch anyway; fewer things that can fail
// install is a good default). classifyRequest() below still classifies
// `/icon-192`, `/icon-512`, `/icon-maskable`, and `/apple-icon` as "static"
// regardless of this list, so cacheFirst() still caches each one the first
// time a page actually requests it -- see fetchVerifiedImage() below for
// why that first request gets a decode-and-retry, not a plain fetch.
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
  if (path === "/apple-icon" || path.startsWith("/apple-icon/")) return "static";
  if (path === "/favicon.ico") return "static";
  // app/icon-192/, app/icon-512/, and app/icon-maskable/route.tsx's routes
  // -- see lib/sw-strategy.ts's copy of these same lines for why they're
  // three independent exact-match routes rather than one shared prefix.
  if (path === "/icon-192") return "static";
  if (path === "/icon-512") return "static";
  if (path === "/icon-maskable") return "static";
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

// Routes verified by actually decoding the response as an image before
// trusting/caching it, with one retry on failure -- see
// fetchVerifiedImage()'s comment for why. Exact paths only, matching
// classifyRequest()'s own exact-match rules for these routes.
const IMAGE_VERIFY_PATHS = new Set(["/icon-192", "/icon-512", "/icon-maskable", "/apple-icon"]);

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const path = classifyRequestPath(request.url);
  const response = IMAGE_VERIFY_PATHS.has(path) ? await fetchVerifiedImage(request) : await fetch(request);

  // Only cache genuinely successful, same-origin ("basic") responses --
  // never an error response or an opaque cross-origin one, under a URL a
  // later request might match against.
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone());
  }
  return response;
}

// v1.6 root-caused a real, CI-only, intermittent Next.js 16.3.0/Turbopack
// bug in how it serves these four generated-icon Route Handlers
// (app/icon-192/, app/icon-512/, app/icon-maskable/, app/apple-icon.tsx):
// under concurrent requests, a response occasionally comes back with the
// CORRECT declared Content-Length but corrupted, undecodable image bytes.
// Confirmed directly, repeatedly, against a real browser and a real
// production build -- and confirmed to be a genuine upstream race, not a
// bug in this app's own rendering (lib/icon-mark.tsx's IconArtwork decodes
// correctly on every isolated request; app/icon-192/route.tsx's header has
// the full investigation). Splitting every icon into its own independent
// route (no shared generateImageMetadata array) measurably shrank how often
// this reproduces, but did not eliminate it outright on CI's more
// resource-constrained runners -- dozens of manual trials locally never
// reproduced it even once, while CI reproduced it on most attempts.
//
// This is the pragmatic mitigation for what's left: actually decode the
// response as an image (createImageBitmap is available in a Service
// Worker's global scope, not just a page's) before trusting it, and retry
// exactly once on failure. A corrupted response is, by every observation
// so far, an independent per-request event, not a sticky per-process one --
// a second attempt has consistently succeeded in every manual trial that
// forced the first to fail. Retrying more than once would start masking a
// genuinely broken deploy instead of absorbing a known, rare, transient
// race; capped at one retry on purpose.
//
// Deliberately scoped to these four exact paths, not every "static"
// asset: verifying a JS/CSS chunk this way would be meaningless (they
// aren't images) and pure waste. If this bug is ever fixed upstream, this
// whole function -- and IMAGE_VERIFY_PATHS above -- can be deleted and
// cacheFirst() reverted to a plain `fetch(request)`.
async function fetchVerifiedImage(request) {
  const first = await fetch(request);
  if (!(await decodesAsImage(first))) {
    return fetch(request);
  }
  return first;
}

async function decodesAsImage(response) {
  if (!response.ok) return false;
  try {
    const bitmap = await createImageBitmap(await response.clone().blob());
    bitmap.close();
    return true;
  } catch {
    return false;
  }
}

// The same query-string/hash-stripping logic classifyRequest() above uses
// internally, pulled out as its own function so cacheFirst() can look up
// IMAGE_VERIFY_PATHS by bare path too. Kept separate from classifyRequest()
// itself, at the cost of this small duplication, rather than refactoring
// that function to call this one -- classifyRequest() must stay an exact,
// diffable mirror of lib/sw-strategy.ts's copy (see its own comment above),
// and this codebase has neither an equivalent nor a need for one there:
// IMAGE_VERIFY_PATHS and the retry it drives are Service-Worker-runtime
// concerns (real fetch, real createImageBitmap) with no pure-function
// equivalent to keep in sync.
function classifyRequestPath(url) {
  if (url.startsWith("/")) return url.split("?")[0].split("#")[0];
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}
