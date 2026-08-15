// Creates the fixed dev-user (see server/context.ts) and the same starter
// categories a real new user gets (lib/defaultCategories.ts -- shared with
// server/data/categories.ts's seedDefaultCategories, so local dev never
// looks different from what real onboarding produces). Idempotent — safe
// to run more than once. Not run automatically by tests (tests/setup.ts
// manages its own fixtures against a separate database); this is for the
// dev database only.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { DEFAULT_CATEGORIES } from "../lib/defaultCategories";

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

async function main() {
  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    create: { id: DEV_USER_ID, email: "dev@localhost" },
    update: {},
  });
  console.log(`Ensured dev user "${DEV_USER_ID}" exists.`);

  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: {
        userId_type_name: { userId: DEV_USER_ID, type: category.type, name: category.name },
      },
      create: {
        userId: DEV_USER_ID,
        type: category.type,
        name: category.name,
        isSystem: true,
        sortOrder: category.sortOrder,
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
