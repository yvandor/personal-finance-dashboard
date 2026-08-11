import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { serverEnv } from "@/server/env";

/**
 * Resolves the "current user" for every server-side data access. This is
 * the ONLY function in the app that produces a userId — every function in
 * server/data/** calls this rather than accepting a userId parameter, which
 * is what makes cross-user access structurally impossible to spoof from a
 * caller (there's no parameter to spoof).
 *
 * Wrapped in React's `cache()` so that multiple DAL calls within the same
 * request/render (e.g. a page that calls listTransactions() and
 * getMonthlySummary() side by side) resolve the user once and share the
 * result, instead of re-reading it independently per call. `cache()` scopes
 * its memoization to a single request — it does not persist across
 * requests or leak between them.
 *
 * AUTHENTICATION (v1.5): resolves the real signed-in user from Auth.js's
 * session (server/auth.ts) — every DAL call, page, and Server Action was
 * already funneled through this one function from the very first
 * migration specifically so this swap would be the only place auth needed
 * to land; no DAL function, action, or page needed to change.
 *
 * Falls back to a fixed DEV_USER_ID only when NODE_ENV !== "production"
 * AND ALLOW_DEV_AUTH_BYPASS === "true" — both conditions required, neither
 * implied by the other, mirroring server/env.ts's PREAUTH_MODE_ACKNOWLEDGED
 * pattern: an explicit, non-production-only escape hatch, never a silent
 * default. This is what keeps `npm run dev`, the full Vitest suite, and CI
 * working without needing real GitHub OAuth App credentials configured —
 * those all still mock this module directly (`vi.mock("@/server/context")`)
 * and never reach `auth()` at all.
 *
 * Otherwise, redirects to /sign-in. `redirect()` (not a thrown custom
 * error) because it already works correctly from Server Components, Server
 * Actions, and Route Handlers alike — no new error type, no changes needed
 * to any Server Action's existing try/catch-to-ActionResult logic. A
 * session that expires mid-form-fill sends that submission straight to
 * /sign-in rather than showing an inline "something went wrong" error,
 * which is the honest behavior: there's no unsaved-data-preserving way to
 * resume after re-authenticating in this architecture, and that's an
 * acceptable, deliberate trade-off for this version.
 *
 * The three branches live in resolveUserId(), exported separately and
 * tested directly (tests/unit/require-user-id.test.ts) rather than through
 * the cache()-wrapped export below -- React's cache() memoizes per-request,
 * scoped via machinery tied to an actual render/request; calling it
 * directly and repeatedly from a plain Vitest test (no real request scope)
 * is exactly the kind of behavior worth not assuming, so the tested logic
 * bypasses the wrapper entirely. Same shape as server/env.ts's
 * assertNotUnguardedProduction() being exported separately from the
 * eager loadServerEnv() call it's used in.
 */
export async function resolveUserId(): Promise<string> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_AUTH_BYPASS === "true") {
    return serverEnv.DEV_USER_ID;
  }

  redirect("/sign-in");
}

export const requireUserId = cache(resolveUserId);
