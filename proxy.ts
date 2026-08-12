import { NextResponse } from "next/server";
import { auth } from "@/server/auth";

// Next.js 16's renamed middleware.ts. UX-only, per docs/PROJECT_PLAN.md §8's
// explicit, pre-existing stance: "Middleware/proxy.ts is for redirect UX
// only, never the authorization boundary." This exists purely to skip
// straight to /sign-in for an unauthenticated visitor rather than rendering
// a protected page's Server Component (and running its DAL queries) only to
// redirect afterward. requireUserId() (server/context.ts) remains the real,
// independent authorization check on every single request path, with or
// without this file.
//
// Runs on the Node.js runtime under Next.js 16 (not the edge runtime
// middleware historically ran on -- verified against Auth.js's own Edge
// Compatibility guide, not assumed), so importing server/auth.ts's full
// config (including the Prisma adapter) here is safe; no edge-safe split
// config is needed.
const PUBLIC_PATHS = [
  /^\/sign-in$/,
  /^\/api\/auth\//,
  /^\/api\/health$/,
  /^\/offline$/,
  /^\/manifest\.webmanifest$/,
  /^\/icon-192$/,
  /^\/icon-512$/,
  /^\/icon-maskable$/,
  /^\/apple-icon$/,
  /^\/favicon\.ico$/,
  /^\/sw\.js$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
}

// Mirrors server/context.ts's resolveUserId() dev-bypass condition exactly
// -- both conditions required, neither implied by the other. Without this,
// proxy.ts and requireUserId() would disagree: the bypass would let
// requireUserId() resolve a user, but proxy.ts (which only knows about a
// real Auth.js session, req.auth) would still redirect every request to
// /sign-in first, since it has no visibility into the bypass at all. This
// is UX-only, same as the rest of this file -- requireUserId() enforces
// this same check independently regardless of what proxy.ts decides.
function devBypassActive(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_AUTH_BYPASS === "true";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return;
  if (devBypassActive()) return;

  if (!req.auth) {
    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }
});

// Excludes Next's own static asset paths at the matcher level (never even
// invokes the function above for them) -- everything else, including every
// app route, goes through isPublicPath's explicit allowlist instead of a
// matcher-level exclusion, so the one list in this file is the complete,
// readable picture of what's public.
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
