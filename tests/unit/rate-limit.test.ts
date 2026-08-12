import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireUserId } from "@/server/context";
import { RateLimitError } from "@/lib/errors";

// server/rateLimit.ts's only external dependency is requireUserId() -- the
// same seam every DAL function and now every Server Action reads through --
// so mocking it here is the same approach as
// tests/integration/transaction-actions.test.ts, just without a database.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

const { enforceMutationRateLimit, __resetRateLimitsForTests } = await import("@/server/rateLimit");

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

beforeEach(() => {
  __resetRateLimitsForTests();
  actAs("user-1");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("enforceMutationRateLimit", () => {
  it("allows a modest number of mutations", async () => {
    for (let i = 0; i < 10; i++) {
      await expect(enforceMutationRateLimit("createTransactionAction")).resolves.toBeUndefined();
    }
  });

  it("throws RateLimitError once a single user exceeds the window budget", async () => {
    for (let i = 0; i < 30; i++) {
      await enforceMutationRateLimit("createTransactionAction");
    }

    await expect(enforceMutationRateLimit("createTransactionAction")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("keeps counters independent per user", async () => {
    for (let i = 0; i < 30; i++) {
      await enforceMutationRateLimit("createTransactionAction");
    }
    await expect(enforceMutationRateLimit("createTransactionAction")).rejects.toBeInstanceOf(RateLimitError);

    actAs("user-2");
    await expect(enforceMutationRateLimit("createTransactionAction")).resolves.toBeUndefined();
  });

  it("shares one budget across every action name, not one bucket per action", async () => {
    for (let i = 0; i < 15; i++) {
      await enforceMutationRateLimit("createTransactionAction");
    }
    for (let i = 0; i < 15; i++) {
      await enforceMutationRateLimit("deleteBudgetAction");
    }

    await expect(enforceMutationRateLimit("createCategoryAction")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("recovers once the oldest hits age out of the window", async () => {
    for (let i = 0; i < 30; i++) {
      await enforceMutationRateLimit("createTransactionAction");
    }
    await expect(enforceMutationRateLimit("createTransactionAction")).rejects.toBeInstanceOf(RateLimitError);

    vi.advanceTimersByTime(60_001);

    await expect(enforceMutationRateLimit("createTransactionAction")).resolves.toBeUndefined();
  });

  it("produces a client-safe, non-empty message", async () => {
    for (let i = 0; i < 30; i++) {
      await enforceMutationRateLimit("createTransactionAction");
    }

    try {
      await enforceMutationRateLimit("createTransactionAction");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).message.length).toBeGreaterThan(0);
    }
  });
});
