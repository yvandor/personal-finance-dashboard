import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

// Standalone child-process script (see e2e/reset-data.ts's comment for why:
// Prisma 7's ESM-only client can't be require()'d by Playwright Test's own
// CJS-oriented loader). Creates a real, database-strategy Auth.js session
// row for the fixed E2E user so production-mode specs (e2e/pwa-production
// and e2e/cache-headers) can reach protected pages the same way a real
// signed-in user would -- proxy.ts's dev bypass is deliberately unavailable
// under NODE_ENV=production (see server/context.ts's resolveUserId()), so
// these specs need an actual Session row, not a bypass. The Prisma
// adapter's getSessionAndUser() looks up the cookie's raw value directly
// against Session.sessionToken (no hashing) -- verified against
// @auth/core's own session action, not assumed -- so the token generated
// here can be set as the cookie value as-is.
// userId/email are optional (argv[3], argv[4]) so cross-user e2e specs (see
// e2e/cross-user.spec.ts) can seed a second, distinct identity alongside the
// fixed DEV_USER_ID one -- defaults preserve the original single-user
// behavior every existing caller (fixtures.ts's seedE2ESession()) relies on.
const [, , outputPath, userIdArg, emailArg] = process.argv;
if (!outputPath) {
  throw new Error("Usage: seed-session.ts <outputPath> [userId] [email]");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const userId = userIdArg ?? process.env.DEV_USER_ID ?? "e2e-dev-user";
const email = emailArg ?? "e2e-dev@example.invalid";

async function main() {
  // The same fixed user resetE2EData() upserts -- production-mode specs
  // call resetE2EData() in their own beforeEach first, so this row already
  // exists by the time a spec seeds a session; upserting the user here too
  // keeps this script safe to call standalone as well. A non-default userId
  // (a second cross-user identity) is upserted the same way.
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email },
    update: {},
  });

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.session.deleteMany({ where: { userId } });
  await prisma.session.create({
    data: { sessionToken, userId, expires },
  });

  writeFileSync(outputPath, JSON.stringify({ sessionToken, expires: expires.toISOString() }), "utf8");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
