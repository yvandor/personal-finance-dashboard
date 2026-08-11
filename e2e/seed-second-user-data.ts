import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

// A standalone script, invoked via `npx tsx` as its own child process --
// same rationale as e2e/reset-data.ts's comment (Prisma 7's ESM-only
// generated client can't be require()'d by Playwright Test's own
// CJS-oriented loader) and the same input/output-via-temp-file shape as
// that script and e2e/seed-session.ts. Not a generalization of
// reset-data.ts (which is hardwired to the single fixed DEV_USER_ID that
// every other spec's beforeEach relies on) -- this exists specifically for
// e2e/cross-user.spec.ts, which needs a SECOND, independent identity with
// its own small, distinctive dataset to verify against the first.
//
// Wipes only this one given userId's owned rows first (so the script is
// safe to call more than once for the same second identity, e.g. across
// a spec file's multiple tests) and seeds exactly one category + one
// transaction with a description unique to this user -- enough to prove
// cross-user isolation without needing this user's full fixture set.

const [, , outputPath, userIdArg, emailArg] = process.argv;
if (!outputPath || !userIdArg || !emailArg) {
  throw new Error("Usage: seed-second-user-data.ts <outputPath> <userId> <email>");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const userId = userIdArg;
const email = emailArg;

// Deliberately distinct from every FIXTURE_CATEGORIES name in
// e2e/reset-data.ts and from any description seeded there, so a spec can
// assert on this text appearing (or not appearing) without ambiguity
// against the default DEV_USER_ID identity's own fixture data.
const CATEGORY_NAME = "Second User Category";
const TRANSACTION_DESCRIPTION = "Second user only expense";

interface SeedResult {
  userId: string;
  categoryId: string;
  transactionId: string;
  transactionDescription: string;
}

async function main() {
  // Explicit per-table deletes, not relied-upon-via-cascade -- same
  // discipline as e2e/reset-data.ts.
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId } });

  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email },
    update: {},
  });

  const category = await prisma.category.create({
    data: {
      userId,
      name: CATEGORY_NAME,
      type: "EXPENSE",
      isSystem: true,
      sortOrder: 0,
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: "EXPENSE",
      amountCents: 12345,
      date: new Date("2026-01-10"),
      description: TRANSACTION_DESCRIPTION,
      categoryId: category.id,
    },
  });

  const result: SeedResult = {
    userId,
    categoryId: category.id,
    transactionId: transaction.id,
    transactionDescription: TRANSACTION_DESCRIPTION,
  };

  writeFileSync(outputPath, JSON.stringify(result), "utf8");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
