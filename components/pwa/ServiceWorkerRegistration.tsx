"use client";

import { useEffect } from "react";

// Registers public/sw.js on mount and renders nothing. Not mounted anywhere
// yet -- app/layout.tsx is intentionally untouched by this slice; the
// integration owner mounts <ServiceWorkerRegistration /> there once this
// component exists (see the v1.4 PWA task notes).
//
// Skipped entirely in development: `next dev`'s own fast-refresh/HMR
// machinery and a live service worker intercepting fetches don't mix well
// (a cached-from-a-previous-run SW can shadow dev-server responses), and
// this app's caching rule set has nothing useful to offer during local
// development anyway (see lib/sw-strategy.ts). This also means Playwright's
// e2e suite -- which runs against `next dev` -- exercises everything about
// this component except the actual `register()` call; that path needs a
// production build to test for real (see e2e/pwa.spec.ts's comments).
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}
