import type { DefaultSession } from "next-auth";

// server/auth.ts's session callback explicitly assigns session.user.id
// from the adapter-loaded user row (database-session mode) -- this
// augmentation is what lets that assignment, and every read of
// session.user.id elsewhere (server/context.ts's requireUserId()), type-check.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
