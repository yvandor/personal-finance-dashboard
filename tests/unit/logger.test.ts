import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  hashEmail,
  logAuthSigninBlocked,
  logAuthSigninSuccess,
  logAuthzDenied,
  logActionUnexpectedError,
  reportUnexpectedActionError,
  authzDenied,
} from "@/server/logger";
import { NotFoundError } from "@/lib/errors";

// These tests are the actual enforcement of server/logger.ts's central
// claim -- that a forbidden field cannot reach a log line. The type
// signatures make it a compile-time property; asserting the EXACT key set
// of every emitted line (not merely that the bad fields are absent) is what
// makes it a runtime one too, and what makes any future field added to an
// event a deliberate, test-updating decision rather than a silent one.

function emittedLines(spy: { mock: { calls: unknown[][] } }): Record<string, unknown>[] {
  return spy.mock.calls.map((call) => JSON.parse(call[0] as string) as Record<string, unknown>);
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("hashEmail", () => {
  it("is deterministic for the same address", () => {
    expect(hashEmail("owner@example.com")).toBe(hashEmail("owner@example.com"));
  });

  it("normalizes case and surrounding whitespace before hashing", () => {
    expect(hashEmail("  Owner@Example.COM  ")).toBe(hashEmail("owner@example.com"));
  });

  it("produces different digests for different addresses", () => {
    expect(hashEmail("owner@example.com")).not.toBe(hashEmail("someone-else@example.com"));
  });

  it("leaks no part of the original address", () => {
    const digest = hashEmail("owner@example.com");
    expect(digest).not.toContain("owner");
    expect(digest).not.toContain("example");
    expect(digest).not.toContain("@");
    // 12 hex chars -- enough to correlate repeats, useless as a
    // confirm-a-guess oracle. See server/logger.ts on why it's truncated.
    expect(digest).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("event field allowlists", () => {
  it("logAuthSigninBlocked emits only ts/level/event/emailHash/provider", () => {
    logAuthSigninBlocked({ emailHash: hashEmail("stranger@example.com"), provider: "github" });

    const [line] = emittedLines(logSpy);
    expect(Object.keys(line).sort()).toEqual(["emailHash", "event", "level", "provider", "ts"]);
    expect(line.event).toBe("auth.signin.blocked");
    expect(line.level).toBe("warn");
  });

  it("logAuthSigninSuccess emits only ts/level/event/userId/provider", () => {
    logAuthSigninSuccess({ userId: "clx0000000000000000000000", provider: "github" });

    const [line] = emittedLines(logSpy);
    expect(Object.keys(line).sort()).toEqual(["event", "level", "provider", "ts", "userId"]);
    expect(line.event).toBe("auth.signin.success");
  });

  it("logAuthzDenied emits only ts/level/event/resource/resourceId", () => {
    logAuthzDenied({ resource: "transaction", resourceId: "tx_123" });

    const [line] = emittedLines(logSpy);
    expect(Object.keys(line).sort()).toEqual(["event", "level", "resource", "resourceId", "ts"]);
    expect(line.event).toBe("authz.denied");
  });

  it("every line is a single self-contained JSON object", () => {
    logAuthSigninSuccess({ userId: "u1", provider: "github" });
    logAuthzDenied({ resource: "budget", resourceId: "b1" });

    expect(logSpy).toHaveBeenCalledTimes(2);
    for (const [line] of logSpy.mock.calls) {
      expect(typeof line).toBe("string");
      expect(line as string).not.toContain("\n");
      expect(() => JSON.parse(line as string)).not.toThrow();
    }
  });
});

describe("logActionUnexpectedError", () => {
  const fields = {
    actionName: "createTransactionAction",
    errorName: "PrismaClientKnownRequestError",
    // Stands in for the real hazard: a Prisma error message quoting the
    // failing query's bound parameters, which for this app means amounts
    // and descriptions.
    errorMessage: 'Invalid `prisma.transaction.create()`: amountCents=125099, description="Therapy session"',
    correlationId: "11111111-2222-3333-4444-555555555555",
  };

  it("omits errorMessage entirely in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    logActionUnexpectedError(fields);

    const [line] = emittedLines(logSpy);
    expect(Object.keys(line).sort()).toEqual(["actionName", "correlationId", "errorName", "event", "level", "ts"]);
    expect(JSON.stringify(line)).not.toContain("125099");
    expect(JSON.stringify(line)).not.toContain("Therapy");
  });

  it("keeps errorMessage outside production, for local debugging", () => {
    vi.stubEnv("NODE_ENV", "development");
    logActionUnexpectedError(fields);

    const [line] = emittedLines(logSpy);
    expect(Object.keys(line).sort()).toEqual([
      "actionName",
      "correlationId",
      "errorMessage",
      "errorName",
      "event",
      "level",
      "ts",
    ]);
  });

  it("truncates a pathologically long message even outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    logActionUnexpectedError({ ...fields, errorMessage: "x".repeat(5_000) });

    const [line] = emittedLines(logSpy);
    expect((line.errorMessage as string).length).toBeLessThanOrEqual(300);
  });
});

describe("reportUnexpectedActionError", () => {
  it("reduces an unknown thrown value to two strings, never the object itself", () => {
    vi.stubEnv("NODE_ENV", "development");
    // A Prisma-shaped error: the `meta` property is exactly what a
    // JSON.stringify of the error object would drag into the log.
    const err = Object.assign(new Error("Unique constraint failed"), {
      name: "PrismaClientKnownRequestError",
      meta: { target: ["userId", "name"], value: "Therapy session" },
    });

    reportUnexpectedActionError("updateBudgetAction", err);

    const [line] = emittedLines(logSpy);
    expect(line.errorName).toBe("PrismaClientKnownRequestError");
    expect(line.errorMessage).toBe("Unique constraint failed");
    expect(JSON.stringify(line)).not.toContain("Therapy");
    expect(JSON.stringify(line)).not.toContain("target");
  });

  it("handles a non-Error throw without leaking its contents", () => {
    vi.stubEnv("NODE_ENV", "development");
    reportUnexpectedActionError("deleteBudgetAction", { amountCents: 4200 });

    const [line] = emittedLines(logSpy);
    expect(line.errorName).toBe("object");
    expect(JSON.stringify(line)).not.toContain("4200");
  });

  it("returns a correlationId matching the one it logged", () => {
    const correlationId = reportUnexpectedActionError("createBudgetAction", new Error("boom"));

    const [line] = emittedLines(logSpy);
    expect(line.correlationId).toBe(correlationId);
  });
});

describe("authzDenied", () => {
  it("logs the denial and returns a NotFoundError, without throwing itself", () => {
    const err = authzDenied("savingsGoal", "goal_abc");

    expect(err).toBeInstanceOf(NotFoundError);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const [line] = emittedLines(logSpy);
    expect(line).toMatchObject({ event: "authz.denied", resource: "savingsGoal", resourceId: "goal_abc" });
  });

  it("keeps every resource's message identical to what the DAL threw before, so no message becomes an existence oracle", () => {
    expect(authzDenied("transaction", "x").message).toBe("Transaction not found");
    expect(authzDenied("category", "x").message).toBe("Category not found");
    expect(authzDenied("budget", "x").message).toBe("Budget not found");
    expect(authzDenied("savingsGoal", "x").message).toBe("Savings goal not found");
    expect(authzDenied("incomeSource", "x").message).toBe("Income source not found");
    expect(authzDenied("recurringBill", "x").message).toBe("Recurring bill not found");
  });

  it("never carries a userId, so the log can't be used to compare owners", () => {
    authzDenied("transaction", "tx_1");
    const [line] = emittedLines(logSpy);
    expect(line).not.toHaveProperty("userId");
  });
});
