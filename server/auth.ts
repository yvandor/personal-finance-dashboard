import "server-only";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db";
import { serverEnv } from "@/server/env";
import { isAllowedSigninEmail } from "@/lib/auth";

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
    async signIn({ user }) {
      return isAllowedSigninEmail(user.email, serverEnv.ALLOWED_SIGNIN_EMAILS);
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
