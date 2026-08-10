import { describe, expect, it } from "vitest";
import {
  incomeSourceOptimisticReducer,
  computeIncomeVsExpected,
  computeExpectedProgress,
  type IncomeSourceExpected,
  type ActualAmountBySource,
} from "@/lib/incomeSources";
import type { IncomeSourceManagementDTO } from "@/server/data/incomeSources";

function makeIncomeSource(overrides: Partial<IncomeSourceManagementDTO> = {}): IncomeSourceManagementDTO {
  return {
    id: "s1",
    name: "Paycheck",
    amountCents: 250000,
    payDay: 15,
    notes: null,
    isActive: true,
    transactionCount: 0,
    ...overrides,
  };
}

describe("incomeSourceOptimisticReducer", () => {
  it("appends a new income source on add", () => {
    const result = incomeSourceOptimisticReducer([], { type: "add", incomeSource: makeIncomeSource() });
    expect(result).toEqual([makeIncomeSource()]);
  });

  it("merges a patch into the matching source on update, leaving others untouched", () => {
    const state = [makeIncomeSource({ id: "s1" }), makeIncomeSource({ id: "s2", name: "Freelance" })];
    const result = incomeSourceOptimisticReducer(state, { type: "update", id: "s1", patch: { name: "Renamed" } });
    expect(result.find((s) => s.id === "s1")?.name).toBe("Renamed");
    expect(result.find((s) => s.id === "s2")?.name).toBe("Freelance");
  });

  it("an update for a nonexistent id is a no-op", () => {
    const state = [makeIncomeSource({ id: "s1" })];
    const result = incomeSourceOptimisticReducer(state, { type: "update", id: "does-not-exist", patch: { name: "x" } });
    expect(result).toEqual(state);
  });

  it("an archive toggle is expressed as an update, not a remove", () => {
    const state = [makeIncomeSource({ id: "s1", isActive: true })];
    const result = incomeSourceOptimisticReducer(state, { type: "update", id: "s1", patch: { isActive: false } });
    expect(result).toHaveLength(1);
    expect(result[0].isActive).toBe(false);
  });
});

describe("computeExpectedProgress", () => {
  it("computes remaining and percent received under the expected amount", () => {
    expect(computeExpectedProgress(100000, 30000)).toEqual({
      remainingCents: 70000,
      percentReceived: 30,
      isFullyReceived: false,
    });
  });

  it("marks fully received once actual meets or exceeds expected, without capping percentReceived", () => {
    expect(computeExpectedProgress(100000, 140000)).toEqual({
      remainingCents: -40000,
      percentReceived: 140,
      isFullyReceived: true,
    });
    expect(computeExpectedProgress(100000, 100000).isFullyReceived).toBe(true);
  });

  it("guards a zero-expected source against divide-by-zero", () => {
    expect(computeExpectedProgress(0, 0)).toEqual({ remainingCents: 0, percentReceived: 0, isFullyReceived: false });
    expect(computeExpectedProgress(0, 500)).toEqual({ remainingCents: -500, percentReceived: 100, isFullyReceived: false });
  });
});

describe("computeIncomeVsExpected", () => {
  const sources: IncomeSourceExpected[] = [
    { id: "s1", name: "Paycheck", expectedCents: 250000 },
    { id: "s2", name: "Freelance", expectedCents: 100000 },
  ];

  it("matches actuals to their source by incomeSourceId", () => {
    const actuals: ActualAmountBySource[] = [
      { incomeSourceId: "s1", amountCents: 250000 },
      { incomeSourceId: "s2", amountCents: 40000 },
    ];
    const result = computeIncomeVsExpected("2026-03", sources, actuals);
    expect(result.sources).toEqual([
      { id: "s1", name: "Paycheck", expectedCents: 250000, actualCents: 250000 },
      { id: "s2", name: "Freelance", expectedCents: 100000, actualCents: 40000 },
    ]);
  });

  it("sums multiple actual rows for the same source", () => {
    const actuals: ActualAmountBySource[] = [
      { incomeSourceId: "s1", amountCents: 100000 },
      { incomeSourceId: "s1", amountCents: 150000 },
    ];
    const result = computeIncomeVsExpected("2026-03", sources, actuals);
    expect(result.sources.find((s) => s.id === "s1")?.actualCents).toBe(250000);
  });

  it("defaults actualCents to 0 for a source with no matching transactions", () => {
    const result = computeIncomeVsExpected("2026-03", sources, []);
    expect(result.sources.every((s) => s.actualCents === 0)).toBe(true);
  });

  it("buckets a null incomeSourceId into unattributedCents, not any source", () => {
    const actuals: ActualAmountBySource[] = [
      { incomeSourceId: "s1", amountCents: 250000 },
      { incomeSourceId: null, amountCents: 5000 },
    ];
    const result = computeIncomeVsExpected("2026-03", sources, actuals);
    expect(result.unattributedCents).toBe(5000);
    expect(result.sources.find((s) => s.id === "s1")?.actualCents).toBe(250000);
  });

  it("sums multiple unattributed rows", () => {
    const actuals: ActualAmountBySource[] = [
      { incomeSourceId: null, amountCents: 1000 },
      { incomeSourceId: null, amountCents: 2000 },
    ];
    const result = computeIncomeVsExpected("2026-03", sources, actuals);
    expect(result.unattributedCents).toBe(3000);
  });

  it("computes totalExpectedCents as the sum of every source's expected amount", () => {
    const result = computeIncomeVsExpected("2026-03", sources, []);
    expect(result.totalExpectedCents).toBe(350000);
  });

  it("computes totalActualCents as the sum of every source's actual plus unattributed", () => {
    const actuals: ActualAmountBySource[] = [
      { incomeSourceId: "s1", amountCents: 250000 },
      { incomeSourceId: "s2", amountCents: 40000 },
      { incomeSourceId: null, amountCents: 5000 },
    ];
    const result = computeIncomeVsExpected("2026-03", sources, actuals);
    expect(result.totalActualCents).toBe(250000 + 40000 + 5000);
  });

  it("returns zeroed totals for no sources and no actuals", () => {
    const result = computeIncomeVsExpected("2026-03", [], []);
    expect(result).toEqual({
      month: "2026-03",
      sources: [],
      unattributedCents: 0,
      totalExpectedCents: 0,
      totalActualCents: 0,
    });
  });

  it("echoes the month through unchanged", () => {
    expect(computeIncomeVsExpected("2026-07", [], []).month).toBe("2026-07");
  });
});
