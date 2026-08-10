import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// A strict-by-default CSP. The only `isDev`-only additions are the two
// below, and both are required for `next dev`'s own tooling, not for
// anything this app's code does:
//   - 'unsafe-eval' in script-src: Turbopack's dev-mode module transform
//     uses eval()-based wrapping for fast refresh; production builds don't.
//   - the ws://localhost/http://localhost connect-src entries: the HMR
//     (Hot Module Replacement) websocket next dev opens to push updates.
//
// script-src's 'unsafe-inline' is NOT a dev-only allowance either, and this
// needed a real investigation rather than being assumed away: Next.js 16's
// App Router streams React Server Component payloads and hydration data to
// the client via inline <script> tags it injects itself (e.g. the `_R_`
// bootstrap script, `self.__next_f.push(...)` data chunks) -- in dev AND in
// production, not just dev. Confirmed by reproducing a Next-internal
// `InvariantError` ("Expected a request ID to be defined for the document
// via self.__next_r") on every page load once a same-origin-only script-src
// was added, and by inspecting page source to find the un-nonced inline
// `<script id="_R_">` tag responsible.
//
// Next.js's own documented fix for this is per-request nonces generated in
// proxy.ts (this version's renamed middleware.ts -- see AGENTS.md), which
// Next then auto-attaches to its inline scripts. That approach was rejected
// here because it requires forcing EVERY page into dynamic rendering
// (disables static optimization, ISR, and PPR app-wide) per Next's own CSP
// guide -- a real architecture change forbidden by this task's "preserve
// the existing architecture" constraint, not a security-vs-convenience
// tradeoff. Instead this uses Next's own documented non-nonce baseline
// CSP (see the "Without Nonces" section of the CSP guide), which allows
// 'unsafe-inline' in script-src unconditionally. This is a real, documented
// reduction in XSS defense-in-depth versus the nonce approach -- it is
// called out as a known limitation, not hidden.
//
// style-src's 'unsafe-inline' is separately required in production for
// real inline `style` attributes this app renders (e.g. BudgetProgressBar's
// dynamic width, Recharts' own SVG styling). Style-attribute injection is a
// materially lower-severity risk than script injection.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self'`,
  `connect-src 'self'${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  // Both of these would already resolve correctly by falling back to
  // script-src/default-src ('self' either way) if left unset -- stated
  // explicitly anyway, matching every other directive in this policy,
  // rather than leaning on an implicit fallback a future edit to
  // script-src could silently change the meaning of. worker-src governs
  // the service worker script itself (public/sw.js, v1.4); manifest-src
  // governs the web app manifest fetch (app/manifest.ts, v1.4).
  `worker-src 'self'`,
  `manifest-src 'self'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt-and-suspenders alongside frame-ancestors 'none' above -- older
  // browsers that don't support CSP's frame-ancestors still get clickjacking
  // protection from this.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Safe to send unconditionally: browsers only ever honor HSTS on an
  // HTTPS response, and explicitly exempt http://localhost from it, so
  // this has no effect in local dev regardless.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // This app doesn't use any of these browser APIs -- denying them is
  // pure defense-in-depth with no functional cost.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
