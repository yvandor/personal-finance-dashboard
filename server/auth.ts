import "server-only";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db";
import { serverEnv } from "@/server/env";
import { isAllowedSigninEmail } from "@/lib/auth";
import { hashEmail, logAuthSigninBlocked, logAuthSigninSuccess } from "@/server/logger";

// The single Auth.js config for this app -- used directly by proxy.ts as
// well as everywhere else (Server Components, Server Actions, the route
// handler below). No separate edge-safe split: Next.js 16's proxy.ts runs
// on the Node.js runtime, not the edge runtime that motivated that split in
// earlier Next.js versions (verified against Auth.js's own Edge
// Compatibility guide, not assumed -- see the v1.5 plan). A second config
// duplicating providers/callbacks would only add a way for the two to
// silently drift.
//
// Database sessions, not JWT (docs/PROJECT_PLAN.md §8): instant
// server-side revocation, rotation-on-sign-in as free fixation mitigation,
// and the DB is already in the request path via requireUserId() on every
// request regardless.
//
// This app has no self-serve sign-up (see lib/auth.ts's isAllowedSigninEmail
// comment) -- the signIn callback below is the enforcement point, checked
// on every sign-in attempt, not just the first one, so removing an email
// from the allowlist takes effect immediately rather than only blocking
// new account creation.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    GitHub({
      // Empty-string fallback, not a non-null assertion: these are still
      // .optional() in server/env.ts as of Phase 0/1 (see that file's
      // comment) -- Phase 2d makes them hard-required in production. An
      // empty clientId/clientSecret simply makes GitHub sign-in fail
      // cleanly rather than crash at import time, which is exactly the
      // right behavior while auth-core is still under construction.
      clientId: serverEnv.AUTH_GITHUB_ID ?? "",
      clientSecret: serverEnv.AUTH_GITHUB_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    // The allowlist decision is logged either way, because both outcomes
    // are security-relevant and each is only interpretable against the
    // other: a blocked attempt matters most when it is NOT surrounded by
    // the owner's own successful sign-ins. Neither line carries the email
    // itself -- see server/logger.ts on why blocked attempts log a
    // truncated digest and successful ones log the opaque user id instead.
    async signIn({ user, account }) {
      // `account` is non-null for the OAuth flow this app actually uses;
      // next-auth types it nullable to cover Credentials/Email providers,
      // which are deliberately not configured here.
      const provider = account?.provider ?? "unknown";

      if (!isAllowedSigninEmail(user.email, serverEnv.ALLOWED_SIGNIN_EMAILS)) {
        // A missing email is itself a rejection (isAllowedSigninEmail fails
        // closed on it), so there is nothing to hash -- the sentinel keeps
        // the field's shape uniform without inventing a digest.
        logAuthSigninBlocked({ emailHash: user.email ? hashEmail(user.email) : "no-email", provider });
        return false;
      }

      logAuthSigninSuccess({ userId: user.id ?? "pending-adapter-create", provider });
      return true;
    },
    // Database-session mode calls this with `{ session, user }` (the
    // adapter-loaded row), not `{ session, token }` (JWT mode) -- explicit
    // here rather than relying on whatever next-auth's default session
    // shape happens to include, matching this codebase's existing
    // "call things out explicitly" discipline (see e.g. next.config.ts's
    // CSP comments).
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
