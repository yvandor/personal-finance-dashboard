import "server-only";
import { requireUserId } from "@/server/context";
import { RateLimitError } from "@/lib/errors";

// A single shared write budget per user across every mutating Server
// Action -- "how many writes has this user made recently," not a separate
// counter per action type -- checked via enforceMutationRateLimit() as the
// first statement inside each action's try block (server/actions/*.ts).
//
// In-memory, per-warm-instance, sliding window. Deliberately no external
// store (Redis/Upstash or similar): this app has zero non-Prisma
// infrastructure today (see docs/PROJECT_PLAN.md §8's "minimal dependency
// surface"), and pulling one in only to gate a portfolio project's write
// rate isn't worth the added attack surface and operational dependency.
//
// The honest limitation, stated once here rather than assumed away: on a
// multi-instance/serverless deployment this budget is per-instance, not
// truly global -- the same user's requests landing on two different warm
// lambdas each get their own counter, so a determined script spread across
// enough concurrent invocations could exceed the intended global rate.
// That's an accepted gap, not an oversight: this is a backstop against a
// single runaway client (a buggy retry loop, a browser tab stuck
// resubmitting), not a hard security boundary -- the real per-user
// isolation and authorization guarantees live entirely in
// server/context.ts's requireUserId() and the DAL's `{ id, userId }`
// scoping, neither of which this module touches or weakens. A shared store
// is the correct next step only once this app has traffic that could
// actually exceed a single instance's memory, which it doesn't yet.
const WINDOW_MS = 60_000;
const MAX_MUTATIONS_PER_WINDOW = 30;

const recentMutations = new Map<string, number[]>();

function recordAndCheck(key: string, now: number): boolean {
  const windowStart = now - WINDOW_MS;
  const timestamps = (recentMutations.get(key) ?? []).filter((t) => t > windowStart);
  timestamps.push(now);
  recentMutations.set(key, timestamps);
  return timestamps.length > MAX_MUTATIONS_PER_WINDOW;
}

/**
 * Call as the first statement inside a mutating Server Action's try block.
 * Resolves the acting user the same way every DAL call does (requireUserId()
 * is React-cache()-memoized per request, so this adds no extra session
 * lookup within a single request) and throws RateLimitError if that user has
 * made more than MAX_MUTATIONS_PER_WINDOW writes in the trailing WINDOW_MS.
 * `actionName` is accepted (mirroring reportUnexpectedActionError's shape)
 * for future per-action budgets or logging, though today every action
 * shares one counter.
 */
export async function enforceMutationRateLimit(actionName: string): Promise<void> {
  void actionName;
  const userId = await requireUserId();
  if (recordAndCheck(userId, Date.now())) {
    throw new RateLimitError();
  }
}

/** Test-only: clears all counters so state can't leak between tests/files. */
export function __resetRateLimitsForTests(): void {
  recentMutations.clear();
}
