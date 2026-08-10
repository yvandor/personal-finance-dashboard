import { describe, expect, it } from "vitest";
import { computeGoalPace, groupContributionsByGoal } from "@/lib/savingsGoals";
import type { ContributionDTO } from "@/server/data/savingsGoals";

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
