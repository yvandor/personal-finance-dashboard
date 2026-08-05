import { prisma } from "@/server/db";
import type { CategoryType } from "@/app/generated/prisma/enums";

// Fixed ids for the two test identities. DEV_USER_ID matches whatever
// server/context.ts's requireUserId() resolves to (via the env var), so
// tests exercising "the current user" don't need to mock anything; tests
// exercising cross-user isolation mock requireUserId() to resolve to
// OTHER_USER_ID instead — see tests/integration/transactions.test.ts.
export const DEV_USER_ID = process.env.DEV_USER_ID ?? "dev-user";
export const OTHER_USER_ID = "other-test-user";

// Runs before each test: wipes both test users' owned rows (never touches
// any other data) and ensures both user rows exist. Cheap enough to run
// per-test given the tiny fixture size, and it keeps every test starting
// from a known, empty state instead of depending on test execution order.
export async function resetTestData(): Promise<void> {
  const userIds = [DEV_USER_ID, OTHER_USER_ID];
  await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.category.deleteMany({ where: { userId: { in: userIds } } });

  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    create: { id: DEV_USER_ID, email: "dev-test@example.invalid" },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: OTHER_USER_ID },
    create: { id: OTHER_USER_ID, email: "other-test@example.invalid" },
    update: {},
  });
}

// Test fixtures create categories directly through Prisma rather than
// through app code — Category CRUD isn't built yet (that's a later phase),
// so this is the test's own setup, not a shortcut around real app logic.
export function createTestCategory(userId: string, type: CategoryType, name: string) {
  return prisma.category.create({ data: { userId, type, name } });
}
