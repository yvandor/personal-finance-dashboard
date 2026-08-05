import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const DEV_USER_ID = process.env.DEV_USER_ID ?? "e2e-dev-user";

export interface SeedTransactionInput {
  type: "INCOME" | "EXPENSE";
  amountCents: number;
  /** "YYYY-MM-DD" */
  date: string;
  description: string;
  categoryName: string;
}

export interface ResetResult {
  /** Category name -> id, for specs that need to select/verify a specific category. */
  categoryIds: Record<string, string>;
}

// Wipes this one fixed user's owned rows and reseeds a known category set
// (optionally also seeding transactions), called from every spec's
// beforeEach -- mirrors tests/setup.ts's resetTestData() for the Vitest
// integration suite. Delegates to e2e/reset-data.ts as a separate child
// process rather than importing Prisma's generated client directly into
// this file (see that script's comment for why -- a real
// require(esm)-cycle error, not a stylistic choice). Because this app has
// exactly one identity and no per-test tenancy (see server/context.ts),
// resetting to a known state before every test is what makes test order
// not matter, not parallel isolation the app doesn't support yet.
export function resetE2EData(seedTransactions: SeedTransactionInput[] = []): ResetResult {
  const id = randomUUID();
  const inputPath = path.join(tmpdir(), `e2e-reset-input-${id}.json`);
  const outputPath = path.join(tmpdir(), `e2e-reset-output-${id}.json`);
  writeFileSync(inputPath, JSON.stringify({ seedTransactions }), "utf8");

  try {
    execSync(`npx tsx e2e/reset-data.ts "${inputPath}" "${outputPath}"`, {
      env: process.env,
      stdio: "pipe",
    });
    return JSON.parse(readFileSync(outputPath, "utf8")) as ResetResult;
  } finally {
    for (const p of [inputPath, outputPath]) {
      try {
        unlinkSync(p);
      } catch {
        // best-effort cleanup of scratch files; a leftover temp file isn't worth failing a test over
      }
    }
  }
}
