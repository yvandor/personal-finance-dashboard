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
  // Explicit, not relied-upon-via-cascade: Budget.categoryId is
  // onDelete: Cascade, so deleting categories below would delete budgets
  // too as a side effect -- but a test suite's cleanup shouldn't depend on
  // that relationship never changing (see server/data/budgets.ts's comment
  // on why that cascade is itself a flagged, not-yet-addressed concern).
  await prisma.budget.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.category.deleteMany({ where: { userId: { in: userIds } } });
  // Same explicit-not-cascade discipline for goals: contributions before
  // the goal that owns them.
  await prisma.savingsContribution.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.savingsGoal.deleteMany({ where: { userId: { in: userIds } } });
  // Same discipline for bills: payments before the bill that owns them,
  // even though RecurringBillPayment.bill is onDelete: Cascade -- explicit
  // here for the same reason as budgets/goals above.
  await prisma.recurringBillPayment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.recurringBill.deleteMany({ where: { userId: { in: userIds } } });
  // Transaction.incomeSourceId is onDelete: SetNull, not Cascade, and
  // transactions are already wiped above -- explicit, not relied-upon,
  // same discipline as every other owned table here.
  await prisma.incomeSource.deleteMany({ where: { userId: { in: userIds } } });

  // `update` is non-empty and resets every mutable field a test might have
  // touched (e.g. currency) -- an empty `update: {}` would only apply on
  // first creation, silently leaking one test's mutation into every test
  // that runs after it in a later suite run, since the row already exists
  // from here on.
  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    create: { id: DEV_USER_ID, email: "dev-test@example.invalid" },
    update: { currency: "USD" },
  });
  await prisma.user.upsert({
    where: { id: OTHER_USER_ID },
    create: { id: OTHER_USER_ID, email: "other-test@example.invalid" },
    update: { currency: "USD" },
  });
}

// Test fixtures create categories directly through Prisma rather than
// through server/data/categories.ts's createCategory -- most tests just
// need a category to exist and shouldn't also be exercising (and
// incidentally depending on) category-creation logic to set that up.
// Tests for createCategory itself live in tests/integration/categories.test.ts.
export function createTestCategory(userId: string, type: CategoryType, name: string) {
  return prisma.category.create({ data: { userId, type, name } });
}

// Same reasoning as createTestCategory above: most income-vs-expected tests
// just need a source to exist, not to also exercise (and depend on)
// createIncomeSource's own validation. Tests for createIncomeSource itself
// live in tests/integration/income-sources.test.ts.
export function createTestIncomeSource(
  userId: string,
  name: string,
  amountCents: number,
  payDay: number,
) {
  return prisma.incomeSource.create({ data: { userId, name, amountCents, payDay } });
}
