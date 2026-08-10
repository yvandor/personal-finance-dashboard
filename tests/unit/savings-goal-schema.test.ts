import { describe, expect, it } from "vitest";
import {
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  savingsContributionCreateSchema,
} from "@/lib/schemas/savingsGoal";

const validCreateInput = {
  name: "Emergency Fund",
  targetCents: 500000,
};

describe("savingsGoalCreateSchema", () => {
  it("accepts a minimal valid goal and defaults the color", () => {
    const result = savingsGoalCreateSchema.parse(validCreateInput);
    expect(result.name).toBe("Emergency Fund");
    expect(result.targetCents).toBe(500000);
    expect(result.color).toBe("#0ea5e9");
  });

  it("accepts an optional description, target date, and explicit color", () => {
    const result = savingsGoalCreateSchema.parse({
      ...validCreateInput,
      description: "Six months of expenses",
      targetDate: "2099-01-01",
      color: "#f97316",
    });
    expect(result.description).toBe("Six months of expenses");
    expect(result.targetDate).toBe("2099-01-01");
    expect(result.color).toBe("#f97316");
  });

  it("rejects a zero or negative target", () => {
    expect(() => savingsGoalCreateSchema.parse({ ...validCreateInput, targetCents: 0 })).toThrow();
    expect(() => savingsGoalCreateSchema.parse({ ...validCreateInput, targetCents: -1 })).toThrow();
  });

  it("rejects a non-integer target", () => {
    expect(() => savingsGoalCreateSchema.parse({ ...validCreateInput, targetCents: 12.5 })).toThrow();
  });

  it("rejects a target date that isn't in the future", () => {
    expect(() => savingsGoalCreateSchema.parse({ ...validCreateInput, targetDate: "2020-01-01" })).toThrow();
  });

  it("rejects a malformed color", () => {
    expect(() => savingsGoalCreateSchema.parse({ ...validCreateInput, color: "blue" })).toThrow();
  });

  it("trims the name and rejects an empty one", () => {
    expect(savingsGoalCreateSchema.parse({ ...validCreateInput, name: "  Trip  " }).name).toBe("Trip");
    expect(() => savingsGoalCreateSchema.parse({ ...validCreateInput, name: "   " })).toThrow();
  });

  it("rejects an unknown extra field (mass-assignment guard)", () => {
    expect(() => savingsGoalCreateSchema.parse({ ...validCreateInput, userId: "someone-else" })).toThrow();
  });
});

describe("savingsGoalUpdateSchema", () => {
  it("accepts an empty object (no-op update)", () => {
    expect(savingsGoalUpdateSchema.parse({})).toEqual({});
  });

  it("accepts a partial update of just the target", () => {
    expect(savingsGoalUpdateSchema.parse({ targetCents: 100000 })).toEqual({ targetCents: 100000 });
  });

  it("allows a target date in the past (an existing goal's date can legitimately have passed)", () => {
    expect(savingsGoalUpdateSchema.parse({ targetDate: "2020-01-01" }).targetDate).toBe("2020-01-01");
  });

  it("allows clearing the target date with null", () => {
    expect(savingsGoalUpdateSchema.parse({ targetDate: null }).targetDate).toBeNull();
  });

  it("allows clearing the description with null", () => {
    expect(savingsGoalUpdateSchema.parse({ description: null }).description).toBeNull();
  });

  it("still validates the fields that are provided", () => {
    expect(() => savingsGoalUpdateSchema.parse({ targetCents: 0 })).toThrow();
    expect(() => savingsGoalUpdateSchema.parse({ name: "" })).toThrow();
  });
});

describe("savingsContributionCreateSchema", () => {
  const validContribution = { amountCents: 5000, date: "2026-03-15" };

  it("accepts a positive contribution", () => {
    expect(savingsContributionCreateSchema.parse(validContribution).amountCents).toBe(5000);
  });

  it("accepts a negative amount (a withdrawal)", () => {
    expect(savingsContributionCreateSchema.parse({ ...validContribution, amountCents: -5000 }).amountCents).toBe(
      -5000,
    );
  });

  it("rejects a zero amount", () => {
    expect(() => savingsContributionCreateSchema.parse({ ...validContribution, amountCents: 0 })).toThrow();
  });

  it("rejects a non-integer amount", () => {
    expect(() => savingsContributionCreateSchema.parse({ ...validContribution, amountCents: 12.5 })).toThrow();
  });

  it("accepts an optional note within the length limit and rejects over it", () => {
    expect(savingsContributionCreateSchema.parse({ ...validContribution, note: "Bonus" }).note).toBe("Bonus");
    expect(() =>
      savingsContributionCreateSchema.parse({ ...validContribution, note: "x".repeat(201) }),
    ).toThrow();
  });

  it("rejects a missing date", () => {
    const withoutDate: Partial<typeof validContribution> = { ...validContribution };
    delete withoutDate.date;
    expect(() => savingsContributionCreateSchema.parse(withoutDate)).toThrow();
  });

  it("rejects an unknown extra field (mass-assignment guard)", () => {
    expect(() => savingsContributionCreateSchema.parse({ ...validContribution, userId: "someone-else" })).toThrow();
  });
});
