import { describe, expect, it } from "vitest";
import { parseArgs, selectUsersForBackfill, type UserCategoryCount } from "../../scripts/backfill-default-categories";

// Pure argument-parsing and selection logic only -- no database. See
// tests/integration/backfill-default-categories.test.ts for the real
// selection + insert behavior against the test database, and
// tests/unit/backfill-owner.test.ts for why DB-touching scripts are
// exercised separately from vitest's shared unit run.

describe("backfill-default-categories parseArgs", () => {
  it("defaults to a dry run when no arguments are given", () => {
    expect(parseArgs([])).toEqual({ ok: true, args: { apply: false } });
  });

  it("parses --apply", () => {
    expect(parseArgs(["--apply"])).toEqual({ ok: true, args: { apply: true } });
  });

  it("errors on an unknown argument", () => {
    const result = parseArgs(["--dry-run"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unknown argument/i);
    }
  });

  it("errors on an unexpected positional argument", () => {
    const result = parseArgs(["some-user-id"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unknown argument/i);
    }
  });
});

describe("backfill-default-categories selectUsersForBackfill", () => {
  it("selects a user whose category count is exactly zero", () => {
    const counts: UserCategoryCount[] = [{ userId: "u1", categoryCount: 0 }];
    expect(selectUsersForBackfill(counts)).toEqual(["u1"]);
  });

  it("skips a user with one or more categories, even just one", () => {
    const counts: UserCategoryCount[] = [{ userId: "u1", categoryCount: 1 }];
    expect(selectUsersForBackfill(counts)).toEqual([]);
  });

  it("skips a user with a large existing category count", () => {
    const counts: UserCategoryCount[] = [{ userId: "u1", categoryCount: 13 }];
    expect(selectUsersForBackfill(counts)).toEqual([]);
  });

  it("selects only the zero-count users out of a mixed set", () => {
    const counts: UserCategoryCount[] = [
      { userId: "empty-1", categoryCount: 0 },
      { userId: "has-some", categoryCount: 3 },
      { userId: "empty-2", categoryCount: 0 },
      { userId: "fully-seeded", categoryCount: 13 },
    ];
    expect(selectUsersForBackfill(counts).sort()).toEqual(["empty-1", "empty-2"]);
  });

  it("returns an empty array when no users have zero categories", () => {
    const counts: UserCategoryCount[] = [
      { userId: "u1", categoryCount: 1 },
      { userId: "u2", categoryCount: 5 },
    ];
    expect(selectUsersForBackfill(counts)).toEqual([]);
  });
});
