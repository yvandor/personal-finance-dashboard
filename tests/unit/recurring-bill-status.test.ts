import { describe, expect, it } from "vitest";
import { computeBillStatus } from "@/lib/recurringBills";

describe("computeBillStatus -- dueDay clamping across month lengths", () => {
  it("clamps dueDay=31 to the 30th in a 30-day month (April)", () => {
    const result = computeBillStatus({ dueDay: 31, isPaid: false, now: new Date("2026-04-15T12:00:00Z") });
    expect(result.dueDate).toBe("2026-04-30");
  });

  it("clamps dueDay=31 to the 28th in February of a non-leap year", () => {
    // 2026 is not divisible by 4 -- a plain non-leap year.
    const result = computeBillStatus({ dueDay: 31, isPaid: false, now: new Date("2026-02-15T12:00:00Z") });
    expect(result.dueDate).toBe("2026-02-28");
  });

  it("clamps dueDay=31 to the 29th in February of a leap year", () => {
    // 2024 is divisible by 4 and not by 100 -- a leap year.
    const result = computeBillStatus({ dueDay: 31, isPaid: false, now: new Date("2024-02-15T12:00:00Z") });
    expect(result.dueDate).toBe("2024-02-29");
  });

  it("does not clamp a dueDay that already fits the month (31st in a 31-day month)", () => {
    const result = computeBillStatus({ dueDay: 31, isPaid: false, now: new Date("2026-01-05T00:00:00Z") });
    expect(result.dueDate).toBe("2026-01-31");
  });

  it("leaves an in-range dueDay untouched regardless of month length", () => {
    const result = computeBillStatus({ dueDay: 15, isPaid: false, now: new Date("2026-02-01T00:00:00Z") });
    expect(result.dueDate).toBe("2026-02-15");
  });
});

describe("computeBillStatus -- status derivation", () => {
  it("is PAID whenever isPaid is true, regardless of the due date", () => {
    // dueDay=5 is already 5 days in the past relative to `now`, which would
    // otherwise be OVERDUE -- isPaid still wins.
    const result = computeBillStatus({ dueDay: 5, isPaid: true, now: new Date("2026-03-10T00:00:00Z") });
    expect(result.status).toBe("PAID");
    expect(result.daysUntilDue).toBe(-5);
  });

  it("is OVERDUE when unpaid and the due date has passed", () => {
    const result = computeBillStatus({ dueDay: 5, isPaid: false, now: new Date("2026-03-10T00:00:00Z") });
    expect(result.status).toBe("OVERDUE");
    expect(result.daysUntilDue).toBeLessThan(0);
  });

  it("is DUE_SOON when unpaid and within the due-soon window", () => {
    // now=03-10, dueDay=12 -> 2 days out.
    const result = computeBillStatus({ dueDay: 12, isPaid: false, now: new Date("2026-03-10T00:00:00Z") });
    expect(result.status).toBe("DUE_SOON");
    expect(result.daysUntilDue).toBe(2);
  });

  it("is DUE_SOON at the exact edge of the window (3 days out)", () => {
    const result = computeBillStatus({ dueDay: 13, isPaid: false, now: new Date("2026-03-10T00:00:00Z") });
    expect(result.status).toBe("DUE_SOON");
    expect(result.daysUntilDue).toBe(3);
  });

  it("is UPCOMING just past the due-soon window (4 days out)", () => {
    const result = computeBillStatus({ dueDay: 14, isPaid: false, now: new Date("2026-03-10T00:00:00Z") });
    expect(result.status).toBe("UPCOMING");
    expect(result.daysUntilDue).toBe(4);
  });

  it("is DUE_SOON (not OVERDUE) when the due date is today", () => {
    const result = computeBillStatus({ dueDay: 10, isPaid: false, now: new Date("2026-03-10T00:00:00Z") });
    expect(result.status).toBe("DUE_SOON");
    expect(result.daysUntilDue).toBe(0);
  });

  it("is UPCOMING far out from the due date", () => {
    const result = computeBillStatus({ dueDay: 28, isPaid: false, now: new Date("2026-03-01T00:00:00Z") });
    expect(result.status).toBe("UPCOMING");
    expect(result.daysUntilDue).toBe(27);
  });
});

describe("computeBillStatus -- injectable now", () => {
  it("defaults to the real wall clock when `now` is omitted, without throwing", () => {
    const result = computeBillStatus({ dueDay: 15, isPaid: false });
    expect(typeof result.dueDate).toBe("string");
    expect(Number.isFinite(result.daysUntilDue)).toBe(true);
    expect(["PAID", "OVERDUE", "DUE_SOON", "UPCOMING"]).toContain(result.status);
  });

  it("ignores the time-of-day component of `now`, comparing calendar dates only", () => {
    const morning = computeBillStatus({ dueDay: 15, isPaid: false, now: new Date("2026-03-10T00:01:00Z") });
    const night = computeBillStatus({ dueDay: 15, isPaid: false, now: new Date("2026-03-10T23:59:00Z") });
    expect(morning.daysUntilDue).toBe(night.daysUntilDue);
    expect(morning.status).toBe(night.status);
  });
});
