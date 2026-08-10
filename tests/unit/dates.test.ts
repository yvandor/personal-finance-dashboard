import { describe, expect, it } from "vitest";
import {
  resolvePeriodRange,
  monthKeyRange,
  currentMonthKey,
  shiftMonthKey,
  monthsBetween,
  clampDayToMonth,
  lastNMonths,
} from "@/lib/dates";

// A fixed reference "now" throughout -- these are relative-period
// calculations ("current month", "current year"), so every test injects
// `now` rather than relying on the real wall clock, which would make
// assertions pass or fail depending on which day the suite happens to run.
const NOW = new Date("2026-03-15T12:00:00Z");

describe("resolvePeriodRange", () => {
  it("resolves current-month to the full calendar month", () => {
    const result = resolvePeriodRange("current-month", NOW);
    expect(result.dateFrom).toBe("2026-03-01");
    expect(result.dateTo).toBe("2026-03-31");
    expect(result.monthKeys).toEqual(["2026-03"]);
  });

  it("resolves last-3-months to include the current month plus the two before it", () => {
    const result = resolvePeriodRange("last-3-months", NOW);
    expect(result.dateFrom).toBe("2026-01-01");
    expect(result.dateTo).toBe("2026-03-31");
    expect(result.monthKeys).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("resolves last-6-months to include the current month plus the five before it", () => {
    const result = resolvePeriodRange("last-6-months", NOW);
    expect(result.dateFrom).toBe("2025-10-01");
    expect(result.dateTo).toBe("2026-03-31");
    expect(result.monthKeys).toEqual(["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
  });

  it("resolves current-year to the full calendar year", () => {
    const result = resolvePeriodRange("current-year", NOW);
    expect(result.dateFrom).toBe("2026-01-01");
    expect(result.dateTo).toBe("2026-12-31");
    expect(result.monthKeys).toHaveLength(12);
    expect(result.monthKeys[0]).toBe("2026-01");
    expect(result.monthKeys[11]).toBe("2026-12");
  });

  it("crosses a year boundary correctly for last-3-months in January", () => {
    const result = resolvePeriodRange("last-3-months", new Date("2026-01-15T12:00:00Z"));
    expect(result.dateFrom).toBe("2025-11-01");
    expect(result.dateTo).toBe("2026-01-31");
    expect(result.monthKeys).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("uses the correct last day for a 30-day and a leap-year February", () => {
    const april = resolvePeriodRange("current-month", new Date("2026-04-10T12:00:00Z"));
    expect(april.dateTo).toBe("2026-04-30");

    const leapFeb = resolvePeriodRange("current-month", new Date("2028-02-10T12:00:00Z"));
    expect(leapFeb.dateTo).toBe("2028-02-29");

    const nonLeapFeb = resolvePeriodRange("current-month", new Date("2026-02-10T12:00:00Z"));
    expect(nonLeapFeb.dateTo).toBe("2026-02-28");
  });
});

describe("monthKeyRange", () => {
  it("returns the first and last day of the given month", () => {
    expect(monthKeyRange("2026-03")).toEqual({ start: "2026-03-01", end: "2026-03-31" });
    expect(monthKeyRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
});

describe("currentMonthKey", () => {
  it("returns the UTC year-month of the given (or real) now", () => {
    expect(currentMonthKey(NOW)).toBe("2026-03");
    expect(currentMonthKey(new Date("2026-12-31T23:00:00Z"))).toBe("2026-12");
  });
});

describe("shiftMonthKey", () => {
  it("shifts forward and backward within a year", () => {
    expect(shiftMonthKey("2026-03", 1)).toBe("2026-04");
    expect(shiftMonthKey("2026-03", -1)).toBe("2026-02");
  });

  it("crosses a year boundary in both directions", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });

  it("is a no-op with a zero delta", () => {
    expect(shiftMonthKey("2026-06", 0)).toBe("2026-06");
  });
});

describe("monthsBetween", () => {
  it("counts whole months when the day-of-month has been reached", () => {
    expect(monthsBetween(new Date("2026-01-15T00:00:00Z"), new Date("2026-04-15T00:00:00Z"))).toBe(3);
  });

  it("does not round up a partial month", () => {
    expect(monthsBetween(new Date("2026-01-15T00:00:00Z"), new Date("2026-04-10T00:00:00Z"))).toBe(2);
  });

  it("returns 0 when to is before or equal to from", () => {
    expect(monthsBetween(new Date("2026-03-15T00:00:00Z"), new Date("2026-01-01T00:00:00Z"))).toBe(0);
    expect(monthsBetween(new Date("2026-03-15T00:00:00Z"), new Date("2026-03-15T00:00:00Z"))).toBe(0);
  });

  it("crosses a year boundary", () => {
    expect(monthsBetween(new Date("2025-11-01T00:00:00Z"), new Date("2026-02-01T00:00:00Z"))).toBe(3);
  });
});

describe("clampDayToMonth", () => {
  it("leaves an in-range day untouched", () => {
    expect(clampDayToMonth(15, "2026-03")).toBe(15);
  });

  it("clamps day 31 to 30 in a 30-day month", () => {
    expect(clampDayToMonth(31, "2026-04")).toBe(30);
  });

  it("clamps day 31 to 28 in a non-leap February", () => {
    expect(clampDayToMonth(31, "2026-02")).toBe(28);
  });

  it("clamps day 31 to 29 in a leap February", () => {
    expect(clampDayToMonth(31, "2028-02")).toBe(29);
  });

  it("leaves day 31 untouched in a 31-day month", () => {
    expect(clampDayToMonth(31, "2026-01")).toBe(31);
  });
});

describe("lastNMonths", () => {
  it("returns n ascending month keys ending at now's month", () => {
    expect(lastNMonths(3, new Date("2026-03-15T00:00:00Z"))).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("returns a single key for n = 1", () => {
    expect(lastNMonths(1, new Date("2026-03-15T00:00:00Z"))).toEqual(["2026-03"]);
  });

  it("crosses a year boundary", () => {
    expect(lastNMonths(4, new Date("2026-01-31T00:00:00Z"))).toEqual(["2025-10", "2025-11", "2025-12", "2026-01"]);
  });
});
