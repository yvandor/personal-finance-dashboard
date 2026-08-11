import { execSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { resetE2EData, seedE2ESession } from "./fixtures";

// v1.5: real cross-user data isolation through the actual UI, using two
// genuine, independent identities (not the app's former single-fixed-user
// assumption -- see server/context.ts's requireUserId()). The default
// identity (DEV_USER_ID) is seeded via resetE2EData(), same as every other
// spec; the second identity is seeded via e2e/seed-second-user-data.ts, a
// standalone child-process script (same "Prisma 7 ESM-only client can't be
// require()'d by Playwright Test's CJS loader" rationale as
// e2e/reset-data.ts and e2e/seed-session.ts) parameterized to a given
// userId/email rather than hardwired to DEV_USER_ID.
//
// Both identities authenticate via a real database-strategy Auth.js
// session (fixtures.ts's seedE2ESession()), not the dev bypass --
// server/context.ts's resolveUserId() checks the real session FIRST, before
// ever consulting the bypass, so this works correctly under the normal
// `npm run test:e2e` dev-mode run (unlike the redirect assertions in
// e2e/auth.spec.ts, this doesn't need the bypass to be off).

const SECOND_USER_ID = "e2e-second-user";
const SECOND_USER_EMAIL = "e2e-second@example.invalid";

interface SecondUserSeed {
  userId: string;
  categoryId: string;
  transactionId: string;
  transactionDescription: string;
}

// Mirrors fixtures.ts's resetE2EData/seedE2ESession exact pattern (temp-file
// in/out, child process via `npx tsx`) but for e2e/seed-second-user-data.ts.
// Defined here rather than in fixtures.ts -- that file is out of this
// change's scope (see this spec's owning task).
function seedSecondUserData(userId: string, email: string): SecondUserSeed {
  const id = randomUUID();
  const outputPath = path.join(tmpdir(), `e2e-second-user-output-${id}.json`);

  try {
    execSync(`npx tsx e2e/seed-second-user-data.ts "${outputPath}" "${userId}" "${email}"`, {
      env: process.env,
      stdio: "pipe",
    });
    return JSON.parse(readFileSync(outputPath, "utf8")) as SecondUserSeed;
  } finally {
    try {
      unlinkSync(outputPath);
    } catch {
      // best-effort cleanup of a scratch file; matches fixtures.ts's identical rationale
    }
  }
}

const FIRST_USER_DESCRIPTION = "First user only expense";

test.describe("Cross-user data isolation", () => {
  let secondUser: SecondUserSeed;

  test.beforeEach(() => {
    resetE2EData([
      {
        type: "EXPENSE",
        amountCents: 4321,
        date: "2026-01-08",
        description: FIRST_USER_DESCRIPTION,
        categoryName: "Groceries",
      },
    ]);
    secondUser = seedSecondUserData(SECOND_USER_ID, SECOND_USER_EMAIL);
  });

  test("identity A (default user) never sees identity B's data on /transactions or /dashboard", async ({
    page,
    context,
  }) => {
    const cookie = seedE2ESession();
    await context.addCookies([cookie]);

    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    let body = page.locator("body");
    await expect(body).toContainText(FIRST_USER_DESCRIPTION);
    await expect(body).not.toContainText(secondUser.transactionDescription);
    await expect(body).not.toContainText("Second User Category");

    await page.goto("/dashboard");
    body = page.locator("body");
    await expect(body).toContainText(FIRST_USER_DESCRIPTION);
    await expect(body).not.toContainText(secondUser.transactionDescription);
  });

  test("identity B (second user) never sees identity A's data on /transactions or /dashboard", async ({
    page,
    context,
  }) => {
    const cookie = seedE2ESession({ userId: SECOND_USER_ID, email: SECOND_USER_EMAIL });
    await context.addCookies([cookie]);

    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    let body = page.locator("body");
    await expect(body).toContainText(secondUser.transactionDescription);
    await expect(body).not.toContainText(FIRST_USER_DESCRIPTION);

    await page.goto("/dashboard");
    body = page.locator("body");
    await expect(body).toContainText(secondUser.transactionDescription);
    await expect(body).not.toContainText(FIRST_USER_DESCRIPTION);
  });

  // The app has no dynamic [id]-segment route today (checked app/ -- the
  // only [..] directory is app/api/auth/[...nextauth]); the one real,
  // directly-navigable id surface is /transactions's `categoryId` query
  // filter (see server/data/transactions.ts's buildWhere: `{ userId,
  // categoryId }` is AND'd together, so a real category id owned by a
  // DIFFERENT user can never match any of the requesting user's own rows --
  // it can only ever produce zero results, never a leak). This is the
  // deep-link case the owning task asked to check when one exists.
  test("identity A navigating directly to identity B's real category id via URL gets zero results, never B's data", async ({
    page,
    context,
  }) => {
    const cookie = seedE2ESession();
    await context.addCookies([cookie]);

    await page.goto(`/transactions?categoryId=${secondUser.categoryId}`);
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();

    const body = page.locator("body");
    await expect(body).not.toContainText(secondUser.transactionDescription);
    await expect(body).not.toContainText("Second User Category");
    // A real, owned-by-another-user categoryId is a well-formed cuid that
    // simply matches zero of this user's rows -- the filtered-empty-state
    // copy (TransactionList.tsx), not an error page and not identity A's
    // unfiltered list (which would otherwise still contain
    // FIRST_USER_DESCRIPTION here).
    await expect(page.getByText("No transactions match these filters")).toBeVisible();
    await expect(body).not.toContainText(FIRST_USER_DESCRIPTION);
  });
});
