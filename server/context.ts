import "server-only";

/**
 * Resolves the "current user" for every server-side data access. This is
 * the ONLY function in the app that produces a userId — every function in
 * server/data/** calls this rather than accepting a userId parameter, which
 * is what makes cross-user access structurally impossible to spoof from a
 * caller (there's no parameter to spoof).
 *
 * TEMPORARY PRE-AUTH STRATEGY: authentication is not implemented yet
 * (see the project plan's Phase 7). Until then, this resolves to a single
 * fixed development user id from the DEV_USER_ID environment variable —
 * every request in this phase acts as that one seeded user. The row itself
 * is created by test setup (tests/setup.ts) and, once a dev server actually
 * needs it, by a seed script.
 *
 * When Auth.js lands, only the body of this function changes to read the
 * real session — no DAL function, action, or page that calls requireUserId()
 * needs to change, and no test that mocks this module needs to change either.
 *
 * Tests that need to act as a *different* user (e.g. cross-user isolation
 * checks) mock this module with `vi.mock("@/server/context")` and swap the
 * resolved id per test — they never pass a userId as a parameter anywhere.
 */
export async function requireUserId(): Promise<string> {
  const id = process.env.DEV_USER_ID;
  if (!id) {
    throw new Error(
      "DEV_USER_ID is not set. Authentication is not implemented yet — set " +
        "DEV_USER_ID in your .env to the id of a seeded user. See server/context.ts.",
    );
  }
  return id;
}
