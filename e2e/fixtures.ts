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

export interface E2ESession {
  sessionToken: string;
  expires: string;
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

// v1.5: production-mode specs (e2e/pwa-production, e2e/cache-headers) need
// to reach real protected pages the same way a signed-in user would --
// proxy.ts's dev bypass is deliberately unavailable whenever
// NODE_ENV=production (see server/context.ts), so `ALLOW_DEV_AUTH_BYPASS`
// alone can't get them past /sign-in there, unlike every other spec's
// dev-mode run. This seeds a real database-strategy Session row (see
// e2e/seed-session.ts) and returns it as a Playwright cookie descriptor for
// context.addCookies() -- an actual Auth.js session, not a bypass, so these
// specs exercise the exact same auth path production traffic does.
export function seedE2ESession(): { name: string; value: string; url: string } {
  const id = randomUUID();
  const outputPath = path.join(tmpdir(), `e2e-session-output-${id}.json`);

  try {
    execSync(`npx tsx e2e/seed-session.ts "${outputPath}"`, {
      env: process.env,
      stdio: "pipe",
    });
    const session = JSON.parse(readFileSync(outputPath, "utf8")) as E2ESession;
    return {
      // Non-secure name (no __Secure- prefix) -- matches @auth/core's
      // defaultCookies() for a non-https AUTH_URL, verified against the
      // installed next-auth package, not assumed. See
      // playwright.config.ts's AUTH_URL for why this run is non-https.
      name: "authjs.session-token",
      value: session.sessionToken,
      url: "http://localhost:3100",
    };
  } finally {
    try {
      unlinkSync(outputPath);
    } catch {
      // best-effort cleanup; see resetE2EData's identical rationale above
    }
  }
}
