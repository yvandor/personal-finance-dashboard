import { readFileSync, writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import type { CategoryType } from "../app/generated/prisma/enums";

// A standalone script, invoked via `npx tsx` as its own child process (see
// e2e/fixtures.ts's resetE2EData) -- never imported directly by Playwright
// Test's own module loader. Prisma 7's "prisma-client" generator emits
// ESM-only output (uses import.meta), which Playwright's CJS-oriented test
// transform can't require() without hitting a require(esm)-cycle error;
// running this as a fully separate process sidesteps that entirely.
// Input/output go through temp files (paths passed as argv), not stdout
// parsing or shell-escaped JSON arguments -- simpler and more robust,
// especially across POSIX/Windows shell quoting differences.

interface SeedTransactionInput {
  type: "INCOME" | "EXPENSE";
  amountCents: number;
  /** "YYYY-MM-DD" */
  date: string;
  description: string;
  categoryName: string;
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  throw new Error("Usage: reset-data.ts <inputPath> <outputPath>");
}

const { seedTransactions } = JSON.parse(readFileSync(inputPath, "utf8")) as {
  seedTransactions: SeedTransactionInput[];
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const DEV_USER_ID = process.env.DEV_USER_ID ?? "e2e-dev-user";

// A small, fixed category set -- enough to exercise every required E2E
// flow without depending on prisma/seed.ts, which is production seed data
// for a real dev database, not E2E fixture data.
const FIXTURE_CATEGORIES: { name: string; type: CategoryType }[] = [
  { name: "Salary", type: "INCOME" },
  { name: "Groceries", type: "EXPENSE" },
  { name: "Dining Out", type: "EXPENSE" },
  { name: "Utilities", type: "EXPENSE" },
];

async function main() {
  await prisma.budget.deleteMany({ where: { userId: DEV_USER_ID } });
  await prisma.transaction.deleteMany({ where: { userId: DEV_USER_ID } });
  await prisma.category.deleteMany({ where: { userId: DEV_USER_ID } });
  // Explicit, not relied-upon-via-cascade -- same discipline as tests/setup.ts.
  await prisma.savingsContribution.deleteMany({ where: { userId: DEV_USER_ID } });
  await prisma.savingsGoal.deleteMany({ where: { userId: DEV_USER_ID } });

  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    create: { id: DEV_USER_ID, email: "e2e-dev@example.invalid" },
    update: { currency: "USD" },
  });

  const categoryIds: Record<string, string> = {};
  for (const [index, category] of FIXTURE_CATEGORIES.entries()) {
    const created = await prisma.category.create({
      data: {
        userId: DEV_USER_ID,
        name: category.name,
        type: category.type,
        isSystem: true,
        sortOrder: index,
      },
    });
    categoryIds[category.name] = created.id;
  }

  for (const t of seedTransactions) {
    await prisma.transaction.create({
      data: {
        userId: DEV_USER_ID,
        type: t.type,
        amountCents: t.amountCents,
        date: new Date(t.date),
        description: t.description,
        categoryId: categoryIds[t.categoryName],
      },
    });
  }

  writeFileSync(outputPath, JSON.stringify({ categoryIds }), "utf8");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
