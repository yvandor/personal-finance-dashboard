import { fileURLToPath } from "node:url";
// Same exemption as e2e/reset-data.ts and e2e/seed-session.ts (see
// eslint.config.mjs's rule comment): a standalone script outside the app's
// request path, constructing its own client for direct, one-off DB access
// the same way those E2E fixtures do -- not the ad-hoc business-logic query
// scattered outside server/data/** the DAL-boundary rule exists to catch.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

// A standalone script, invoked via `npx tsx scripts/backfill-owner.ts <userId>
// [--apply]` as its own process -- same reasoning as e2e/reset-data.ts and
// e2e/seed-session.ts: Prisma 7's "prisma-client" generator emits ESM-only
// output (uses import.meta), so this can't be require()'d by a CJS-oriented
// loader; running it standalone sidesteps that entirely. Unlike those two,
// this isn't E2E fixture data -- it's a one-time migration for a REAL
// database: every pre-auth row is currently owned by the fixed DEV_USER_ID
// (see server/context.ts's resolveUserId()), and once someone signs in for
// real via GitHub OAuth, Auth.js's Prisma adapter creates a brand-new User
// row with its own id. This script reassigns DEV_USER_ID's existing rows to
// that real user's id so historical data isn't orphaned.
//
// The pure argument-parsing and precondition logic below (parseArgs,
// checkPreconditions) is factored out and exported specifically so
// tests/unit/backfill-owner.test.ts can exercise it without a database --
// same "export the pure part separately" pattern as
// server/context.ts's resolveUserId being exported apart from its
// cache()-wrapped requireUserId.

// Every model with a userId column, in the order printed by --dry-run (the
// order the task's own checklist listed them in). This is NOT the order
// operations run in during --apply -- see runReassignment's comment below
// for why that order differs.
export const REASSIGNABLE_TABLES = [
  { model: "transaction", label: "transactions" },
  { model: "category", label: "categories" },
  { model: "budget", label: "budgets" },
  { model: "savingsGoal", label: "savingsGoals" },
  { model: "savingsContribution", label: "savingsContributions" },
  { model: "incomeSource", label: "incomeSources" },
  { model: "recurringBill", label: "recurringBills" },
  { model: "recurringBillPayment", label: "recurringBillPayments" },
] as const;

export type TableLabel = (typeof REASSIGNABLE_TABLES)[number]["label"];

const USAGE =
  "Usage: npx tsx scripts/backfill-owner.ts <targetUserId> [--apply]\n\n" +
  "Reassigns every DEV_USER_ID-owned row (transactions, categories, budgets,\n" +
  "savings goals/contributions, income sources, recurring bills/payments) to\n" +
  "<targetUserId> -- the real User row Auth.js's Prisma adapter created when\n" +
  "someone actually signed in. Dry-run by default: prints a per-table row\n" +
  "count and writes nothing. Pass --apply to perform the reassignment.";

export interface ParsedArgs {
  targetUserId: string;
  apply: boolean;
}

export type ParseArgsResult = { ok: true; args: ParsedArgs } | { ok: false; error: string };

// Deliberately never guesses or defaults the target userId -- it must be
// named explicitly on the command line every time, so this can never
// silently reassign data to the wrong account.
export function parseArgs(argv: string[]): ParseArgsResult {
  const positional: string[] = [];
  let apply = false;

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
    } else if (arg.startsWith("--")) {
      return { ok: false, error: `Unknown flag: "${arg}".\n\n${USAGE}` };
    } else {
      positional.push(arg);
    }
  }

  if (positional.length === 0) {
    return { ok: false, error: `Missing required <targetUserId> argument.\n\n${USAGE}` };
  }
  if (positional.length > 1) {
    return { ok: false, error: `Too many positional arguments: ${positional.join(", ")}.\n\n${USAGE}` };
  }

  const [targetUserId] = positional;
  if (targetUserId.trim() === "") {
    return { ok: false, error: `<targetUserId> can't be empty.\n\n${USAGE}` };
  }

  return { ok: true, args: { targetUserId, apply } };
}

export interface PreconditionCheck {
  devUserId: string;
  targetUserId: string;
  targetUserExists: boolean;
  rowCountsByTable: Record<TableLabel, number>;
}

export type PreconditionResult = { ok: true } | { ok: false; error: string };

// Pure validation over already-fetched facts, kept apart from the DB calls
// that produce them specifically so it's unit-testable without a database.
// Both refusals here are "clear error, zero partial writes" -- checked
// BEFORE runReassignment ever opens a $transaction, in both dry-run and
// --apply modes, since neither a preview nor a real run means anything once
// either condition holds.
export function checkPreconditions(check: PreconditionCheck): PreconditionResult {
  if (!check.targetUserExists) {
    return {
      ok: false,
      error:
        `Target user "${check.targetUserId}" does not exist in the users table yet. ` +
        `Refusing to reassign data to a user that hasn't signed in for real -- ` +
        `sign in once via GitHub OAuth first so Auth.js's Prisma adapter creates the row, ` +
        `then re-run this script with that user's id.`,
    };
  }

  const totalRows = Object.values(check.rowCountsByTable).reduce((sum: number, n) => sum + n, 0);
  if (totalRows === 0) {
    return {
      ok: false,
      error:
        `DEV_USER_ID ("${check.devUserId}") owns zero rows across every reassignable table -- ` +
        `nothing to backfill.`,
    };
  }

  return { ok: true };
}

function printDryRun(rowCountsByTable: Record<TableLabel, number>): void {
  console.log("Rows that would be reassigned:");
  for (const { label } of REASSIGNABLE_TABLES) {
    console.log(`  ${label}: ${rowCountsByTable[label]}`);
  }
  console.log("\nDry run only -- no rows were changed. Re-run with --apply to perform the reassignment.");
}

// Kept generic over the two Prisma client shapes (the real PrismaClient and
// its $transaction-callback tx) rather than importing Prisma's own
// namespace type just for this one helper's signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any;

// All eight reassignments run inside one interactive transaction: either
// every table's rows move to the new owner, or none of them do.
//
// Every constraint deferred below is a composite same-owner foreign key
// (see prisma/schema.prisma) -- the child's (someId, userId) pair must
// match an existing (id, userId) pair on the parent. Reassigning EITHER
// side alone leaves that pair momentarily inconsistent, and no ordering
// avoids it: the two rows can only become consistent again once BOTH
// updates have run. Found by rehearsing this script against a real
// database (not assumed), which is why every one of them is DEFERRABLE
// INITIALLY IMMEDIATE -- normal application traffic still gets the
// original immediate check (zero behavior change there), but this script
// can explicitly defer them all to end-of-transaction, making the eight
// updates' relative order genuinely not matter.
//
// The first two date from 20260811075601_defer_same_owner_fks; the other
// five were added by 20260811120000_v1_6_same_owner_fks, which closed the
// gap where savings, income, and recurring-bill relations had no
// database-level same-owner check at all and leaned on application-level
// ownership checks alone. Anything added to that migration must be listed
// here too, or a future run fails partway through.
async function runReassignment(prisma: PrismaLike, devUserId: string, targetUserId: string): Promise<void> {
  await prisma.$transaction(async (tx: PrismaLike) => {
    await tx.$executeRaw`SET CONSTRAINTS "transactions_category_same_owner", "budgets_category_same_owner", "transactions_income_source_same_owner", "savings_contributions_goal_same_owner", "recurring_bill_payments_bill_same_owner", "recurring_bills_category_same_owner", "recurring_bill_payments_transaction_same_owner" DEFERRED`;
    await tx.category.updateMany({ where: { userId: devUserId }, data: { userId: targetUserId } });
    await tx.transaction.updateMany({ where: { userId: devUserId }, data: { userId: targetUserId } });
    await tx.budget.updateMany({ where: { userId: devUserId }, data: { userId: targetUserId } });
    await tx.savingsGoal.updateMany({ where: { userId: devUserId }, data: { userId: targetUserId } });
    await tx.savingsContribution.updateMany({ where: { userId: devUserId }, data: { userId: targetUserId } });
    await tx.incomeSource.updateMany({ where: { userId: devUserId }, data: { userId: targetUserId } });
    await tx.recurringBill.updateMany({ where: { userId: devUserId }, data: { userId: targetUserId } });
    await tx.recurringBillPayment.updateMany({ where: { userId: devUserId }, data: { userId: targetUserId } });
  });
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exitCode = 1;
    return;
  }
  const { targetUserId, apply } = parsed.args;

  // Same fallback as tests/setup.ts's DEV_USER_ID constant -- the fixed
  // identity every pre-auth row in a real, non-e2e database is currently
  // owned by (see server/context.ts's resolveUserId()).
  const devUserId = process.env.DEV_USER_ID ?? "dev-user";

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const [targetUser, ...counts] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetUserId } }),
      ...REASSIGNABLE_TABLES.map(({ model }) => (prisma as PrismaLike)[model].count({ where: { userId: devUserId } })),
    ]);

    const rowCountsByTable = Object.fromEntries(
      REASSIGNABLE_TABLES.map(({ label }, i) => [label, counts[i] as number]),
    ) as Record<TableLabel, number>;

    const precondition = checkPreconditions({
      devUserId,
      targetUserId,
      targetUserExists: targetUser !== null,
      rowCountsByTable,
    });
    if (!precondition.ok) {
      console.error(precondition.error);
      process.exitCode = 1;
      return;
    }

    if (!apply) {
      printDryRun(rowCountsByTable);
      return;
    }

    console.log(`Reassigning DEV_USER_ID ("${devUserId}")'s rows to "${targetUserId}"...`);
    await runReassignment(prisma, devUserId, targetUserId);
    console.log("Done -- all rows reassigned inside a single transaction.");
  } finally {
    await prisma.$disconnect();
  }
}

// Only run main() when this file is executed directly (`npx tsx
// scripts/backfill-owner.ts ...`), not when tests/unit/backfill-owner.test.ts
// imports parseArgs/checkPreconditions from it -- there's no CJS
// `require.main === module` under Prisma 7's ESM-only output, so this
// compares argv[1] against the module's own URL instead.
const isMainModule = process.argv[1] !== undefined && process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
