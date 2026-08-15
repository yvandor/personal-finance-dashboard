import { fileURLToPath } from "node:url";
import { DEFAULT_CATEGORIES } from "../lib/defaultCategories";

// PrismaPg/PrismaClient are imported dynamically inside main() below, not
// at module top level: this file's pure/testable exports (parseArgs,
// selectUsersForBackfill, fetchCategoryCounts, applyBackfill) are imported
// directly by tests/unit/backfill-default-categories.test.ts and
// tests/integration/backfill-default-categories.test.ts, and the latter
// also imports tests/setup.ts, which pulls in @/server/rateLimit ->
// @/server/context -> next/navigation. A top-level import of
// @prisma/adapter-pg alongside that chain in the same module graph trips a
// Vite/Vitest SSR module-resolution conflict (next/navigation's bundled
// React reference ends up unresolved) -- reproduced in isolation while
// building this script. Deferring the import to inside main(), which only
// runs when this file is executed directly (see isMainModule below), keeps
// the test-imported surface free of that combination entirely.

// A standalone script, invoked via `npx tsx scripts/backfill-default-categories.ts
// [--apply]` -- same reasoning as scripts/backfill-owner.ts for running as
// its own process rather than being imported into the app or the test
// suite. One-time migration for users who signed up (or were seeded)
// before default categories existed: every user with ZERO categories gets
// the same starter set a brand-new signup now gets automatically
// (server/data/categories.ts's seedDefaultCategories, wired to Auth.js's
// events.createUser in server/auth.ts).
//
// Deliberately narrower than "fill in whatever defaults are missing": a
// user is only touched here if their total category count is EXACTLY
// zero. Anyone with one or more categories -- a custom one, a partial set
// from a previous partial run, anything -- is skipped entirely and left
// completely alone. This backfill fills empty lists; it never tops up or
// merges into an existing one. (seedDefaultCategories itself is safe to
// call for a non-empty list too -- see its own comment -- but this script
// intentionally never does that, to keep "existing users' categories are
// never touched" true without any exceptions to reason about.)

const USAGE =
  "Usage: npx tsx scripts/backfill-default-categories.ts [--apply]\n\n" +
  "Seeds the standard default categories (lib/defaultCategories.ts) for every\n" +
  "existing user whose total category count is exactly zero. Users who already\n" +
  "have one or more categories are skipped entirely, even if some default names\n" +
  "are missing. Dry-run by default: prints which users would be affected and\n" +
  "writes nothing. Pass --apply to perform it. Safe to re-run: a user who was\n" +
  "already backfilled (or who signs up for real in the meantime) no longer has\n" +
  "zero categories, so a later run leaves them alone on its own.";

export interface ParsedArgs {
  apply: boolean;
}

export type ParseArgsResult = { ok: true; args: ParsedArgs } | { ok: false; error: string };

export function parseArgs(argv: string[]): ParseArgsResult {
  let apply = false;
  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
    } else {
      return { ok: false, error: `Unknown argument: "${arg}".\n\n${USAGE}` };
    }
  }
  return { ok: true, args: { apply } };
}

export interface UserCategoryCount {
  userId: string;
  categoryCount: number;
}

// Pure selection logic, kept apart from the DB query that produces its
// input -- same "pure part separately testable" pattern as
// scripts/backfill-owner.ts's checkPreconditions. Exactly zero, not "fewer
// than N" -- see the file-level comment on why partial category lists are
// left alone.
export function selectUsersForBackfill(counts: UserCategoryCount[]): string[] {
  return counts.filter((c) => c.categoryCount === 0).map((c) => c.userId);
}

// Kept generic over the real PrismaClient and an equivalent test client --
// same reasoning as scripts/backfill-owner.ts's PrismaLike -- so
// tests/integration/backfill-default-categories.test.ts can exercise the
// real selection + insert behavior against the test database without this
// module importing @/server/db itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any;

export async function fetchCategoryCounts(prisma: PrismaLike): Promise<UserCategoryCount[]> {
  const users = await prisma.user.findMany({
    select: { id: true, _count: { select: { categories: true } } },
  });
  return users.map((u: { id: string; _count: { categories: number } }) => ({
    userId: u.id,
    categoryCount: u._count.categories,
  }));
}

// One createMany per selected user (not a single cross-user statement):
// each call is independently idempotent via the categories table's
// (userId, type, name) unique constraint, so a failure partway through
// leaves already-processed users correctly seeded rather than rolling back
// unrelated users' rows.
export async function applyBackfill(prisma: PrismaLike, userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        userId,
        name: c.name,
        type: c.type,
        isSystem: true,
        sortOrder: c.sortOrder,
      })),
      skipDuplicates: true,
    });
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exitCode = 1;
    return;
  }
  const { apply } = parsed.args;

  // Same exemption as scripts/backfill-owner.ts (see eslint.config.mjs's
  // rule comment): a standalone script outside the app's request path,
  // constructing its own client for direct, one-off DB access. Dynamic,
  // not a top-level import -- see the file-level comment above -- which
  // also means the restricted-imports rule never flags this line.
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../app/generated/prisma/client");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const counts = await fetchCategoryCounts(prisma);
    const selected = selectUsersForBackfill(counts);

    if (selected.length === 0) {
      console.log("No users with zero categories found -- nothing to backfill.");
      return;
    }

    if (!apply) {
      console.log(`Users that would receive default categories (${selected.length}):`);
      for (const id of selected) console.log(`  ${id}`);
      console.log("\nDry run only -- no rows were changed. Re-run with --apply to perform the backfill.");
      return;
    }

    console.log(`Seeding default categories for ${selected.length} user(s)...`);
    await applyBackfill(prisma, selected);
    console.log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

// Only run main() when this file is executed directly, not when
// tests/unit/backfill-default-categories.test.ts or
// tests/integration/backfill-default-categories.test.ts import from it --
// same isMainModule guard as scripts/backfill-owner.ts.
const isMainModule = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
