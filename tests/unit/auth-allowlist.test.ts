import { describe, expect, it } from "vitest";
import { isAllowedSigninEmail } from "@/lib/auth";

describe("isAllowedSigninEmail", () => {
  it("allows an email present in the allowlist", () => {
    expect(isAllowedSigninEmail("owner@example.com", "owner@example.com")).toBe(true);
  });

  it("allows any of several comma-separated emails", () => {
    const allowlist = "a@example.com, owner@example.com,b@example.com";
    expect(isAllowedSigninEmail("owner@example.com", allowlist)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAllowedSigninEmail("Owner@Example.com", "owner@example.com")).toBe(true);
    expect(isAllowedSigninEmail("owner@example.com", "Owner@Example.com")).toBe(true);
  });

  it("trims whitespace around each entry and the candidate email", () => {
    expect(isAllowedSigninEmail("  owner@example.com  ", " owner@example.com , b@example.com ")).toBe(true);
  });

  it("rejects an email not in the allowlist", () => {
    expect(isAllowedSigninEmail("attacker@example.com", "owner@example.com")).toBe(false);
  });

  it("rejects when the allowlist is empty or unset -- fails closed, never open", () => {
    expect(isAllowedSigninEmail("owner@example.com", "")).toBe(false);
    expect(isAllowedSigninEmail("owner@example.com", undefined)).toBe(false);
  });

  it("rejects a null or undefined email", () => {
    expect(isAllowedSigninEmail(null, "owner@example.com")).toBe(false);
    expect(isAllowedSigninEmail(undefined, "owner@example.com")).toBe(false);
  });

  it("does not accidentally allow a substring match", () => {
    // "owner@example.com" must not match because it *contains*
    // "wner@example.co" or similar -- exact set-membership only.
    expect(isAllowedSigninEmail("notowner@example.com", "owner@example.com")).toBe(false);
  });
});
