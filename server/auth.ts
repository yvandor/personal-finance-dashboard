import "server-only";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db";
import { serverEnv } from "@/server/env";
import { logAuthSigninSuccess } from "@/server/logger";

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
// Public beta (v1.7): any account that completes GitHub OAuth may sign in --
// there is no email allowlist anymore. Authentication itself (GitHub OAuth
// + database sessions) is unchanged, and per-user data isolation is
// enforced entirely elsewhere: every DAL call is scoped through
// requireUserId() (server/context.ts), which reads the authenticated
// session's own user id -- never a client-supplied one -- so it does not
// depend on who was allowed to sign in.
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
    // No allowlist check: any account that completes the OAuth flow above
    // may sign in. Still logged -- a successful sign-in is security-relevant
    // on its own, not just as the counterpart to a blocked one -- see
    // server/logger.ts on why it logs the opaque user id rather than the
    // email.
    async signIn({ user, account }) {
      // `account` is non-null for the OAuth flow this app actually uses;
      // next-auth types it nullable to cover Credentials/Email providers,
      // which are deliberately not configured here.
      const provider = account?.provider ?? "unknown";

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
