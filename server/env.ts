import "server-only";
import { z } from "zod";

// Validated once, at first import, rather than trusting raw
// `process.env.X` reads scattered across the codebase. A missing or empty
// DATABASE_URL now fails loudly and immediately -- naming which variable is
// missing, never its value -- instead of surfacing much later as a
// confusing Prisma connection error. server/db.ts and server/context.ts are
// the only two modules that ever read anything from here; every other
// server module reaches these values only through those two, the same "one
// seam" pattern requireUserId() itself already uses.
// AUTH_SECRET/AUTH_GITHUB_ID/AUTH_GITHUB_SECRET stay
// .optional() in this schema -- they're genuinely optional outside
// production, where ALLOW_DEV_AUTH_BYPASS (server/context.ts) lets local
// dev and the test suite run without real GitHub OAuth App credentials
// configured. assertProductionAuthConfigured() below is what makes them
// hard-required specifically whenever NODE_ENV=production.
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required -- see .env.example."),
  // .optional() as of v1.6, having been hard-required since the pre-auth
  // build. Exactly one line in the request-serving path still reads it --
  // server/context.ts's dev-bypass branch -- and that branch is unreachable
  // in production twice over: NODE_ENV !== "production" AND
  // ALLOW_DEV_AUTH_BYPASS === "true" are both required, and the
  // PREAUTH_MODE_ACKNOWLEDGED escape hatch that once let production reach it
  // was removed outright in v1.5 Phase 2d. Everything else that consumes it
  // (tests/setup.ts, e2e/fixtures.ts, e2e/reset-data.ts,
  // scripts/backfill-owner.ts) reads process.env.DEV_USER_ID directly with
  // its own fallback and never goes through this schema at all.
  // Keeping it required therefore bought no safety and cost something real:
  // a production deployment would have had to invent a meaningless
  // placeholder value purely to get past validation -- a secret-shaped env
  // var set to a lie, which is worse than absent, because the next reader
  // has to work out whether it means anything. Absent now means absent.
  // server/context.ts fails loudly if the bypass is ever asked for without
  // it, so a misconfigured local dev environment still gets a clear error
  // rather than a silent undefined user.
  DEV_USER_ID: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),
});

// docs/PROJECT_PLAN.md §8: "this app must never serve real traffic without
// real authentication configured," enforced in code, not just
// documentation. Through v1.5 Phase 0/1, requireUserId() (server/context.ts)
// could still fall back to one fixed DEV_USER_ID in production via a
// PREAUTH_MODE_ACKNOWLEDGED escape hatch -- that escape hatch has been
// REMOVED (not tightened) now that real Auth.js v5 authentication
// (server/auth.ts) is verified end-to-end: production must have real
// GitHub OAuth configuration, full stop, with no override.
//
// Checked at BUILD time too, not just runtime: `next build` statically
// prerenders several routes by actually executing their Server Component
// code (confirmed empirically -- /bills, /categories, /goals are all
// prerendered, see README's route table), and Next's CLI forces
// NODE_ENV=production for that command regardless of the calling shell's
// own NODE_ENV. A runtime-only check would let a production bundle get
// built -- and, on some platforms, deployed straight from that build step
// -- without this configuration ever being verified. This is why CI's
// `build` step and any local `next build` now both need real (if
// throwaway, in CI) values for every variable below; see
// .github/workflows/ci.yml and playwright.config.ts's production-mode
// webServer env.
export function assertProductionAuthConfigured(): void {
  if (process.env.NODE_ENV !== "production") return;

  const required = ["AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"] as const;
  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Refusing to build or start in production: missing required auth configuration (${missing.join(", ")}). ` +
        "Real authentication (Auth.js v5 GitHub OAuth -- see server/auth.ts) must be fully configured " +
        "before this app can serve real traffic or real financial data (docs/PROJECT_PLAN.md §8). " +
        "There is no pre-auth escape hatch anymore.",
    );
  }
}

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    DEV_USER_ID: process.env.DEV_USER_ID,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment configuration -- missing or empty: ${missing}.`);
  }
  assertProductionAuthConfigured();
  return parsed.data;
}

export const serverEnv = loadServerEnv();
