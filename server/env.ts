import "server-only";
import { z } from "zod";

// Validated once, at first import, rather than trusting raw
// `process.env.X` reads scattered across the codebase. A missing or empty
// DATABASE_URL/DEV_USER_ID now fails loudly and immediately -- naming
// which variable is missing, never its value -- instead of surfacing much
// later as a confusing Prisma connection error or a silent
// wrong/undefined-user bug. server/db.ts and server/context.ts are the
// only two modules that ever read these two variables; every other server
// module reaches them only through those two, the same "one seam" pattern
// requireUserId() itself already uses.
// AUTH_SECRET/AUTH_GITHUB_ID/AUTH_GITHUB_SECRET/ALLOWED_SIGNIN_EMAILS are
// deliberately .optional() here in v1.5's Phase 0/1 -- local dev and the
// test suite both keep working via ALLOW_DEV_AUTH_BYPASS
// (server/context.ts) without needing real GitHub OAuth App credentials
// configured. Phase 2d makes these hard-required whenever
// NODE_ENV=production, replacing (not supplementing) the
// PREAUTH_MODE_ACKNOWLEDGED escape hatch below -- see that phase's commit
// for the tightened guard.
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required -- see .env.example."),
  DEV_USER_ID: z.string().min(1, "DEV_USER_ID is required -- see .env.example and server/context.ts."),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),
  // Comma-separated email allowlist -- this app has no self-serve sign-up
  // story (see docs/PROJECT_PLAN.md §8 and README's Roadmap): only accounts
  // whose email appears here may complete sign-in, checked in
  // server/auth.ts's signIn callback. Parsed into a Set by lib/auth.ts's
  // isAllowedSigninEmail(), not here, so the parsing logic is independently
  // unit-testable.
  ALLOWED_SIGNIN_EMAILS: z.string().optional(),
});

// docs/PROJECT_PLAN.md §8: "the pre-auth build ... must never be deployed to
// a public host or bound to a non-loopback interface," enforced until now
// only by documentation, not code. requireUserId() (server/context.ts)
// resolves every request to one fixed DEV_USER_ID -- fine for local
// development, an active liability the moment NODE_ENV=production means
// this process is serving (or being built to serve) real traffic.
//
// Checked at BUILD time too, not just runtime: `next build` statically
// prerenders several routes by actually executing their Server Component
// code (confirmed empirically -- /bills, /categories, /goals are all
// prerendered, see README's route table), and Next's CLI forces
// NODE_ENV=production for that command regardless of the calling shell's
// own NODE_ENV. A runtime-only check would let a production bundle get
// built -- and, on some platforms, deployed straight from that build step
// -- without anyone ever having to acknowledge the gate. This is why CI's
// `build` step and any local `next build` now both require the escape
// hatch below; see .github/workflows/ci.yml.
export function assertNotUnguardedProduction(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.PREAUTH_MODE_ACKNOWLEDGED === "true") return;
  throw new Error(
    "Refusing to build or start in production: this app has no authentication yet " +
      "(every request acts as one fixed user -- see server/context.ts) and must never " +
      "serve real traffic or real financial data (docs/PROJECT_PLAN.md §8). If this is " +
      "a deliberate pre-auth deployment you're restricting access to some other way " +
      "(a private URL, a platform-level password, an IP allowlist), set " +
      "PREAUTH_MODE_ACKNOWLEDGED=true to proceed anyway.",
  );
}

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    DEV_USER_ID: process.env.DEV_USER_ID,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    ALLOWED_SIGNIN_EMAILS: process.env.ALLOWED_SIGNIN_EMAILS,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment configuration -- missing or empty: ${missing}.`);
  }
  assertNotUnguardedProduction();
  return parsed.data;
}

export const serverEnv = loadServerEnv();
