import "server-only";
import { z } from "zod";

// Validated once, at first import, rather than trusting raw
// `process.env.X` reads scattered across the codebase. A missing or empty
// DATABASE_URL/DEV_USER_ID now fails loudly and immediately -- naming
// which variable is missing, never its value -- instead of surfacing much
// later as a confusing Prisma connection error or a silent
// wrong/undefined-user bug. server/db.ts and server/context.ts are the
// only two modules that ever read these two variables; every other server
// module reaches them only through those two, the same "one seam" pattern
// requireUserId() itself already uses.
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required -- see .env.example."),
  DEV_USER_ID: z.string().min(1, "DEV_USER_ID is required -- see .env.example and server/context.ts."),
});

function loadServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    DEV_USER_ID: process.env.DEV_USER_ID,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment configuration -- missing or empty: ${missing}.`);
  }
  return parsed.data;
}

export const serverEnv = loadServerEnv();
