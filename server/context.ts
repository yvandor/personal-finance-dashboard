import "server-only";
import { cache } from "react";
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
 * requests or leak between them, so this is purely a per-request dedupe,
 * not a global cache of "the current user."
 *
 * TEMPORARY PRE-AUTH STRATEGY: authentication is not implemented yet
 * (see the project plan's Phase 7). Until then, this resolves to a single
 * fixed development user id from the DEV_USER_ID environment variable —
 * every request in this phase acts as that one seeded user. The row itself
 * is created by test setup (tests/setup.ts) and, once a dev server actually
 * needs it, by a seed script. This behavior is intentionally unchanged by
 * the cache() wrapper: same input (none), same resolved id, just memoized.
 *
 * When Auth.js lands, only the body of this function changes to read the
 * real session — no DAL function, action, or page that calls requireUserId()
 * needs to change, and no test that mocks this module needs to change either.
 *
 * Tests that need to act as a *different* user (e.g. cross-user isolation
 * checks) mock this module with `vi.mock("@/server/context")` and swap the
 * resolved id per test — they never pass a userId as a parameter anywhere,
 * and the mock replaces this function entirely, so cache() plays no part
 * in tests.
 */
export const requireUserId = cache(async (): Promise<string> => {
  // serverEnv already validated DEV_USER_ID is present (and threw a clear,
  // named error at import time if not) -- see server/env.ts.
  return serverEnv.DEV_USER_ID;
});
