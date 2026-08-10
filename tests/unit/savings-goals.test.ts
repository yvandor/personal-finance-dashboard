import { describe, expect, it } from "vitest";
import { computeGoalPace, computeGoalProgress, groupContributionsByGoal, goalOptimisticReducer } from "@/lib/savingsGoals";
import type { ContributionDTO, SavingsGoalProgressDTO } from "@/server/data/savingsGoals";

const NOW = new Date("2026-03-15T12:00:00Z");
const CREATED_JAN_1 = new Date("2026-01-01T00:00:00Z");

describe("computeGoalPace", () => {
  it("computes required-per-month as remaining divided by months left", () => {
    const pace = computeGoalPace({
      targetDate: new Date("2026-07-01T00:00:00Z"), // ~3.5 months out from NOW
      createdAt: CREATED_JAN_1,
      startingCents: 0,
      currentCents: 30000,
      remainingCents: 70000,
      now: NOW,
    });
    // monthsBetween(NOW=03-15, target=07-01) -> 3 whole months (day 1 < day 15)
    expect(pace.monthsRemaining).toBe(3);
    expect(pace.requiredPerMonthCents).toBe(Math.ceil(70000 / 3));
    expect(pace.isOverdue).toBe(false);
  });

  it("flags an overdue goal instead of a negative or infinite figure", () => {
    const pace = computeGoalPace({
      targetDate: new Date("2026-01-01T00:00:00Z"), // in the past relative to NOW
      createdAt: CREATED_JAN_1,
      startingCents: 0,
      currentCents: 10000,
      remainingCents: 40000,
      now: NOW,
    });
    expect(pace.isOverdue).toBe(true);
    expect(pace.monthsRemaining).toBe(0);
    expect(pace.requiredPerMonthCents).toBe(40000); // the full remainder, due "now"
    expect(Number.isFinite(pace.requiredPerMonthCents)).toBe(true);
    expect(pace.requiredPerMonthCents).toBeGreaterThanOrEqual(0);
  });

  it("never divides by zero when the target date is within the current month", () => {
    const pace = computeGoalPace({
      targetDate: new Date("2026-03-20T00:00:00Z"), // 5 days after NOW, same month
      createdAt: CREATED_JAN_1,
      startingCents: 0,
      currentCents: 10000,
      remainingCents: 5000,
      now: NOW,
    });
    expect(pace.isOverdue).toBe(false);
    expect(pace.monthsRemaining).toBe(0);
    expect(Number.isFinite(pace.requiredPerMonthCents)).toBe(true);
    expect(pace.requiredPerMonthCents).toBe(5000);
  });

  it("marks onTrack true when the average contribution rate meets the required pace", () => {
    // Created Jan 1, now Mar 15 -> 2 elapsed months. Saved 40000 so far -> 20000/month average.
    const pace = computeGoalPace({
      targetDate: new Date("2026-09-01T00:00:00Z"),
      createdAt: CREATED_JAN_1,
      startingCents: 0,
      currentCents: 40000,
      remainingCents: 20000, // needs little more, well within reach
      now: NOW,
    });
    expect(pace.onTrack).toBe(true);
  });

  it("marks onTrack false when the average contribution rate falls short", () => {
    // Elapsed 2 months, saved only 1000 -> 500/month average, but a lot is still needed soon.
    const pace = computeGoalPace({
      targetDate: new Date("2026-04-01T00:00:00Z"),
      createdAt: CREATED_JAN_1,
      startingCents: 0,
      currentCents: 1000,
      remainingCents: 99000,
      now: NOW,
    });
    expect(pace.onTrack).toBe(false);
  });

  it("an overdue goal is never onTrack", () => {
    const pace = computeGoalPace({
      targetDate: new Date("2026-01-01T00:00:00Z"),
      createdAt: CREATED_JAN_1,
      startingCents: 0,
      currentCents: 99999,
      remainingCents: 1,
      now: NOW,
    });
    expect(pace.isOverdue).toBe(true);
    expect(pace.onTrack).toBe(false);
  });

  it("does not divide by zero computing the average rate for a goal created today", () => {
    const pace = computeGoalPace({
      targetDate: new Date("2026-06-01T00:00:00Z"),
      createdAt: NOW,
      startingCents: 0,
      currentCents: 0,
      remainingCents: 50000,
      now: NOW,
    });
    expect(Number.isFinite(pace.requiredPerMonthCents)).toBe(true);
  });
});

describe("computeGoalProgress", () => {
  it("computes remaining and percent complete under target", () => {
    expect(computeGoalProgress(100000, 30000)).toEqual({ remainingCents: 70000, percentComplete: 30 });
  });

  it("clamps remainingCents at 0 for an overfunded goal, without capping percentComplete", () => {
    expect(computeGoalProgress(100000, 140000)).toEqual({ remainingCents: 0, percentComplete: 140 });
  });

  it("guards a zero-target goal against divide-by-zero", () => {
    expect(computeGoalProgress(0, 0)).toEqual({ remainingCents: 0, percentComplete: 0 });
    expect(computeGoalProgress(0, 500)).toEqual({ remainingCents: 0, percentComplete: 100 });
  });
});

describe("groupContributionsByGoal", () => {
  function makeContribution(overrides: Partial<ContributionDTO> = {}): ContributionDTO {
    return {
      id: "c1",
      goalId: "g1",
      amountCents: 1000,
      date: "2026-01-01",
      note: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("groups contributions by their goalId", () => {
    const grouped = groupContributionsByGoal([
      makeContribution({ id: "c1", goalId: "g1" }),
      makeContribution({ id: "c2", goalId: "g2" }),
      makeContribution({ id: "c3", goalId: "g1" }),
    ]);
    expect(grouped.get("g1")?.map((c) => c.id)).toEqual(["c1", "c3"]);
    expect(grouped.get("g2")?.map((c) => c.id)).toEqual(["c2"]);
  });

  it("returns an empty map for an empty input", () => {
    expect(groupContributionsByGoal([]).size).toBe(0);
  });

  it("returns undefined for a goal with no contributions (caller defaults to an empty array)", () => {
    const grouped = groupContributionsByGoal([makeContribution({ goalId: "g1" })]);
    expect(grouped.get("g2")).toBeUndefined();
  });
});

function makeGoal(overrides: Partial<SavingsGoalProgressDTO> = {}): SavingsGoalProgressDTO {
  return {
    id: "g1",
    name: "Trip",
    description: null,
    targetCents: 100000,
    startingCents: 0,
    targetDate: null,
    status: "ACTIVE",
    color: "#0ea5e9",
    achievedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    currentCents: 0,
    remainingCents: 100000,
    percentComplete: 0,
    isAchieved: false,
    pace: null,
    ...overrides,
  };
}

describe("goalOptimisticReducer", () => {
  it("appends a new goal on add", () => {
    const result = goalOptimisticReducer([], { type: "add", goal: makeGoal() });
    expect(result).toEqual([makeGoal()]);
  });

  it("merges a patch into the matching goal on update, leaving others untouched", () => {
    const state = [makeGoal({ id: "g1" }), makeGoal({ id: "g2", name: "Other" })];
    const result = goalOptimisticReducer(state, { type: "update", id: "g1", patch: { currentCents: 5000 } });
    expect(result.find((g) => g.id === "g1")?.currentCents).toBe(5000);
    expect(result.find((g) => g.id === "g2")?.name).toBe("Other");
  });

  it("removes the matching goal on remove, leaving others untouched", () => {
    const state = [makeGoal({ id: "g1" }), makeGoal({ id: "g2" })];
    const result = goalOptimisticReducer(state, { type: "remove", id: "g1" });
    expect(result.map((g) => g.id)).toEqual(["g2"]);
  });
});
