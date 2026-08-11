import { describe, expect, it } from "vitest";
import {
  parseArgs,
  checkPreconditions,
  REASSIGNABLE_TABLES,
  type TableLabel,
} from "../../scripts/backfill-owner";

// Pure argument-parsing and precondition logic only -- no database. A full
// DB-integration test (actually running --apply against Postgres) is
// deliberately not included here: this repo's test suite shares its
// integration databases with concurrent agents/CI runs on fixed ports (see
// tests/setup.ts), and this script performs real cross-table writes rather
// than reads, so it's exercised manually / in a dedicated environment
// instead of vitest's shared integration run.

function zeroCounts(): Record<TableLabel, number> {
  return Object.fromEntries(REASSIGNABLE_TABLES.map(({ label }) => [label, 0])) as Record<TableLabel, number>;
}

describe("backfill-owner parseArgs", () => {
  it("parses a bare targetUserId as a dry run (apply: false)", () => {
    const result = parseArgs(["real-user-123"]);
    expect(result).toEqual({ ok: true, args: { targetUserId: "real-user-123", apply: false } });
  });

  it("parses targetUserId with --apply", () => {
    const result = parseArgs(["real-user-123", "--apply"]);
    expect(result).toEqual({ ok: true, args: { targetUserId: "real-user-123", apply: true } });
  });

  it("accepts --apply before the positional argument", () => {
    const result = parseArgs(["--apply", "real-user-123"]);
    expect(result).toEqual({ ok: true, args: { targetUserId: "real-user-123", apply: true } });
  });

  it("never defaults or guesses a targetUserId -- errors when none is given", () => {
    const result = parseArgs([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/missing required <targetUserId>/i);
    }
  });

  it("errors when only --apply is given, with no targetUserId", () => {
    const result = parseArgs(["--apply"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/missing required <targetUserId>/i);
    }
  });

  it("errors on more than one positional argument", () => {
    const result = parseArgs(["user-a", "user-b"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/too many positional arguments/i);
    }
  });

  it("errors on an unknown flag", () => {
    const result = parseArgs(["real-user-123", "--dry-run"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/unknown flag/i);
    }
  });

  it("errors on an empty-string targetUserId", () => {
    const result = parseArgs([""]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/can't be empty/i);
    }
  });
});

describe("backfill-owner checkPreconditions", () => {
  it("refuses to run when the target user doesn't exist", () => {
    const result = checkPreconditions({
      devUserId: "dev-user",
      targetUserId: "nonexistent-real-user",
      targetUserExists: false,
      rowCountsByTable: { ...zeroCounts(), transactions: 5 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/does not exist/i);
    }
  });

  it("refuses to run when DEV_USER_ID has zero rows across every table", () => {
    const result = checkPreconditions({
      devUserId: "dev-user",
      targetUserId: "real-user-123",
      targetUserExists: true,
      rowCountsByTable: zeroCounts(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/zero rows/i);
    }
  });

  it("passes when the target user exists and at least one table has rows", () => {
    const result = checkPreconditions({
      devUserId: "dev-user",
      targetUserId: "real-user-123",
      targetUserExists: true,
      rowCountsByTable: { ...zeroCounts(), categories: 3 },
    });
    expect(result).toEqual({ ok: true });
  });

  it("sums rows across every table, not just one, before concluding there's nothing to do", () => {
    // No single table has rows on its own reasoning path -- only the total
    // across every table matters for the "zero rows to reassign" refusal.
    const counts = zeroCounts();
    counts.recurringBillPayments = 1;
    const result = checkPreconditions({
      devUserId: "dev-user",
      targetUserId: "real-user-123",
      targetUserExists: true,
      rowCountsByTable: counts,
    });
    expect(result).toEqual({ ok: true });
  });

  it("prioritizes the missing-target-user refusal even when DEV_USER_ID also has zero rows", () => {
    const result = checkPreconditions({
      devUserId: "dev-user",
      targetUserId: "nonexistent-real-user",
      targetUserExists: false,
      rowCountsByTable: zeroCounts(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/does not exist/i);
    }
  });
});

describe("backfill-owner REASSIGNABLE_TABLES", () => {
  it("covers exactly the eight userId-owned tables the task specifies", () => {
    const labels = REASSIGNABLE_TABLES.map((t) => t.label).sort();
    expect(labels).toEqual(
      [
        "budgets",
        "categories",
        "incomeSources",
        "recurringBillPayments",
        "recurringBills",
        "savingsContributions",
        "savingsGoals",
        "transactions",
      ].sort(),
    );
  });
});
