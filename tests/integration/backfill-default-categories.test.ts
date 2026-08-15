import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { fetchCategoryCounts, selectUsersForBackfill, applyBackfill } from "../../scripts/backfill-default-categories";
import { DEFAULT_CATEGORIES } from "@/lib/defaultCategories";
import { DEV_USER_ID, OTHER_USER_ID, createTestCategory, resetTestData } from "../setup";

// Exercises the backfill script's real selection + insert behavior against
// the test database, unlike scripts/backfill-owner.ts's tests (see that
// script's own test file for why it stays unit-only). This script only
// ever performs additive, per-user createMany+skipDuplicates inserts into
// the categories table -- never a cross-table or cross-user write -- so
// it's safe to run against the same shared integration database as every
// other file in tests/integration/, following the exact same
// DEV_USER_ID/OTHER_USER_ID + resetTestData() convention.
//
// Same @/server/context mock as every other file in tests/integration/
// (see e.g. categories.test.ts). Nothing in this file calls
// requireUserId() directly, but tests/setup.ts imports @/server/rateLimit,
// which imports the real @/server/context -- and the real module pulls in
// next/navigation, which doesn't load cleanly under Vitest's SSR module
// resolution in this project (reproduced in isolation while building this
// test). Mocking it here, consistent with every sibling file, avoids ever
// evaluating that real import chain.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

describe("backfill-default-categories", () => {
  beforeEach(async () => {
    await resetTestData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("selects a user with zero categories for backfill", async () => {
    // resetTestData() leaves both DEV_USER_ID and OTHER_USER_ID with zero
    // categories.
    const counts = await fetchCategoryCounts(prisma);
    const selected = selectUsersForBackfill(counts);
    expect(selected).toContain(DEV_USER_ID);
    expect(selected).toContain(OTHER_USER_ID);
  });

  it("skips a user with one or more categories completely -- their existing category is left untouched", async () => {
    const existing = await createTestCategory(OTHER_USER_ID, "EXPENSE", "Their Own Category");

    const counts = await fetchCategoryCounts(prisma);
    const selected = selectUsersForBackfill(counts);
    expect(selected).not.toContain(OTHER_USER_ID);
    expect(selected).toContain(DEV_USER_ID);

    await applyBackfill(prisma, selected);

    // OTHER_USER_ID was never selected, so applyBackfill never touched
    // them: still exactly their one original category, unmodified.
    const theirCategories = await prisma.category.findMany({ where: { userId: OTHER_USER_ID } });
    expect(theirCategories).toHaveLength(1);
    expect(theirCategories[0]?.id).toBe(existing.id);
    expect(theirCategories[0]?.name).toBe("Their Own Category");

    // DEV_USER_ID, who had zero, got the full default set.
    const devCategories = await prisma.category.findMany({ where: { userId: DEV_USER_ID } });
    expect(devCategories).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it("remains idempotent across repeated --apply runs", async () => {
    // First run: DEV_USER_ID has zero categories, gets selected and seeded.
    let counts = await fetchCategoryCounts(prisma);
    let selected = selectUsersForBackfill(counts);
    expect(selected).toContain(DEV_USER_ID);
    await applyBackfill(prisma, selected);

    const afterFirstRun = await prisma.category.count({ where: { userId: DEV_USER_ID } });
    expect(afterFirstRun).toBe(DEFAULT_CATEGORIES.length);

    // Second run: DEV_USER_ID now has 13 categories, so the selection step
    // itself excludes them -- not just the insert being a no-op.
    counts = await fetchCategoryCounts(prisma);
    selected = selectUsersForBackfill(counts);
    expect(selected).not.toContain(DEV_USER_ID);

    // Applying again over the (now-empty, for DEV_USER_ID) selection changes nothing.
    await applyBackfill(prisma, selected);
    const afterSecondRun = await prisma.category.count({ where: { userId: DEV_USER_ID } });
    expect(afterSecondRun).toBe(DEFAULT_CATEGORIES.length);

    // Even calling applyBackfill directly on an already-seeded user (bypassing
    // selection) stays idempotent, thanks to skipDuplicates -- belt-and-braces
    // on top of the selection-level guarantee above.
    await applyBackfill(prisma, [DEV_USER_ID]);
    const afterDirectReapply = await prisma.category.count({ where: { userId: DEV_USER_ID } });
    expect(afterDirectReapply).toBe(DEFAULT_CATEGORIES.length);
  });
});
