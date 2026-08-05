import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

// A standalone script (see reset-data.ts's comment on why this isn't
// imported directly into Playwright's own process). Used by
// global-teardown.ts to leave the E2E database fully empty once the whole
// suite finishes, rather than merely deterministic-per-test -- deleting
// the user row cascades to every row it owns (see the schema's
// onDelete: Cascade on Category/Transaction/Budget's userId relation).
const DEV_USER_ID = process.env.DEV_USER_ID ?? "e2e-dev-user";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.user.deleteMany({ where: { id: DEV_USER_ID } });
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
