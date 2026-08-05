import { describe, expect, it } from "vitest";
import { parseMoneyToCents, formatCents } from "@/lib/money";

describe("parseMoneyToCents", () => {
  it("parses a whole dollar amount", () => {
    expect(parseMoneyToCents("12")).toBe(1200);
  });

  it("parses a two-decimal amount", () => {
    expect(parseMoneyToCents("12.34")).toBe(1234);
  });

  it("parses a single-decimal amount", () => {
    expect(parseMoneyToCents("12.3")).toBe(1230);
  });

  it("parses a leading-dot amount", () => {
    expect(parseMoneyToCents(".50")).toBe(50);
  });

  it("parses zero", () => {
    expect(parseMoneyToCents("0")).toBe(0);
  });

  it("trims surrounding whitespace", () => {
    expect(parseMoneyToCents("  12.34  ")).toBe(1234);
  });

  it("rejects a negative amount", () => {
    expect(() => parseMoneyToCents("-12.34")).toThrow();
  });

  it("rejects more than two decimal places", () => {
    expect(() => parseMoneyToCents("12.345")).toThrow();
  });

  it("rejects thousands separators", () => {
    expect(() => parseMoneyToCents("1,234.00")).toThrow();
  });

  it("rejects non-numeric input", () => {
    expect(() => parseMoneyToCents("abc")).toThrow();
  });

  it("rejects an empty string", () => {
    expect(() => parseMoneyToCents("")).toThrow();
  });

  it("rejects a lone decimal point", () => {
    expect(() => parseMoneyToCents(".")).toThrow();
  });
});

describe("formatCents", () => {
  it("formats a whole-dollar amount", () => {
    expect(formatCents(1200)).toBe("$12.00");
  });

  it("formats an amount with cents", () => {
    expect(formatCents(1234)).toBe("$12.34");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });

  it("formats a large amount with a thousands separator", () => {
    expect(formatCents(123456789)).toBe("$1,234,567.89");
  });
});
