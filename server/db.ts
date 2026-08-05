import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

// Prisma 7's generated client has no bundled query engine binary — it talks
// to Postgres through an explicit driver adapter (`@prisma/adapter-pg`,
// wrapping `pg`) instead of connecting from a bare connection string.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Reused across Hot Module Replacement in dev so `next dev` doesn't open a
// fresh connection pool on every file save.
const globalForPrisma = globalThis as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
