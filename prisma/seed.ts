// Creates the fixed dev-user (see server/context.ts) and a starter set of
// categories, so a fresh clone has something to select in the transaction
// form. Idempotent — safe to run more than once. Not run automatically by
// tests (tests/setup.ts manages its own fixtures against a separate
// database); this is for the dev database only.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

function requireDevUserId(): string {
  const id = process.env.DEV_USER_ID;
  if (!id) {
    throw new Error("DEV_USER_ID must be set to seed the database. See .env.example.");
  }
  return id;
}

const DEV_USER_ID = requireDevUserId();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_CATEGORIES: Array<{ name: string; type: "INCOME" | "EXPENSE" }> = [
  { name: "Salary", type: "INCOME" },
  { name: "Freelance", type: "INCOME" },
  { name: "Other Income", type: "INCOME" },
  { name: "Housing", type: "EXPENSE" },
  { name: "Groceries", type: "EXPENSE" },
  { name: "Transport", type: "EXPENSE" },
  { name: "Utilities", type: "EXPENSE" },
  { name: "Dining Out", type: "EXPENSE" },
  { name: "Health", type: "EXPENSE" },
  { name: "Entertainment", type: "EXPENSE" },
  { name: "Shopping", type: "EXPENSE" },
  { name: "Other", type: "EXPENSE" },
];

async function main() {
  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    create: { id: DEV_USER_ID, email: "dev@localhost" },
    update: {},
  });
  console.log(`Ensured dev user "${DEV_USER_ID}" exists.`);

  for (const [index, category] of DEFAULT_CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: {
        userId_type_name: { userId: DEV_USER_ID, type: category.type, name: category.name },
      },
      create: {
        userId: DEV_USER_ID,
        type: category.type,
        name: category.name,
        isSystem: true,
        sortOrder: index,
      },
      update: {},
    });
  }
  console.log(`Ensured ${DEFAULT_CATEGORIES.length} default categories exist.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
