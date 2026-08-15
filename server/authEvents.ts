import "server-only";
import { seedDefaultCategories } from "@/server/data/categories";

// Auth.js's events.createUser handler, factored out of server/auth.ts so
// it's unit-testable (a mocked seedDefaultCategories) in isolation --
// importing @/server/auth directly pulls in next-auth's own Next.js
// internals (next/server), which Vitest's SSR module resolution can't
// load under this project's "react-server" condition (vitest.config.mts).
// This file has no such dependency, so
// tests/unit/auth-handle-user-created.test.ts can import it directly.
//
// `id` is typed optional on Auth.js's shared User shape (it also covers
// JWT-mode users, which have no adapter-assigned id), but the adapter has
// always just assigned one by the time this event fires for a real
// createUser -- same defensive-not-crashing shape as server/auth.ts's
// signIn callback's own `user.id ?? "pending-adapter-create"`.
export async function handleUserCreated({ user }: { user: { id?: string } }): Promise<void> {
  if (!user.id) return;
  await seedDefaultCategories(user.id);
}
