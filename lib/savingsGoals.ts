import { monthsBetween } from "@/lib/dates";
import type { ContributionDTO } from "@/server/data/savingsGoals";

export interface GoalPace {
  /** 0 once the target month has been reached or passed -- never negative. */
  monthsRemaining: number;
  /** Ceiling'd so this is never an understatement of what's actually needed. */
  requiredPerMonthCents: number;
  isOverdue: boolean;
  onTrack: boolean;
}

/**
 * Pace math for a savings goal with a target date, kept pure and
 * dependency-free (same convention as lib/budgets.ts) so it's unit-testable
 * with injected dates instead of only exercisable through the DAL.
 *
 * requiredPerMonthCents = remaining ÷ months left (docs/PROJECT_PLAN.md's
 * Savings Goals AC). A goal whose target date has already passed without
 * being met is `isOverdue: true` rather than a negative or infinite
 * months-remaining figure -- the AC's own explicit requirement. Callers
 * should only call this for a goal that isn't already achieved (an achieved
 * goal has no meaningful "pace").
 *
 * `onTrack` compares that forward-looking requirement against the goal's
 * own average contribution rate *since it was created*
 * ((currentCents - startingCents) ÷ months elapsed) -- a simple, honest
 * heuristic, not a promise: it can't see lump-sum front-loading or a
 * contribution pattern about to change, only the average so far.
 */
export function computeGoalPace(params: {
  targetDate: Date;
  createdAt: Date;
  startingCents: number;
  currentCents: number;
  remainingCents: number;
  now?: Date;
}): GoalPace {
  const now = params.now ?? new Date();
  const monthsRemaining = monthsBetween(now, params.targetDate);
  const isOverdue = monthsRemaining === 0 && params.targetDate <= now;

  const requiredPerMonthCents = isOverdue
    ? params.remainingCents
    : Math.ceil(params.remainingCents / Math.max(monthsRemaining, 1));

  const elapsedMonths = Math.max(monthsBetween(params.createdAt, now), 1);
  const averagePerMonthCents = (params.currentCents - params.startingCents) / elapsedMonths;
  const onTrack = !isOverdue && averagePerMonthCents >= requiredPerMonthCents;

  return { monthsRemaining, requiredPerMonthCents, isOverdue, onTrack };
}

// Pure, dependency-free grouping -- extracted out of
// app/(dashboard)/goals/page.tsx so it's unit-testable directly, same
// reasoning as lib/budgets.ts's filterAvailableBudgetCategories. The
// `ContributionDTO` import is type-only and erased at compile time.
export function groupContributionsByGoal(contributions: ContributionDTO[]): Map<string, ContributionDTO[]> {
  const byGoal = new Map<string, ContributionDTO[]>();
  for (const c of contributions) {
    const existing = byGoal.get(c.goalId);
    if (existing) {
      existing.push(c);
    } else {
      byGoal.set(c.goalId, [c]);
    }
  }
  return byGoal;
}
