import { describe, expect, it, vi, afterEach } from "vitest";
import { assertProductionAuthConfigured } from "@/server/env";

// Exercises the production auth guard as a standalone function call against
// stubbed process.env, not by re-triggering server/env.ts's own
// module-level `loadServerEnv()` -- that already ran once at first import
// (using this test run's real env, where NODE_ENV="test") and its result is
// cached in the exported `serverEnv`, same as every other test file that
// transitively imports server/env.ts. vi.stubEnv (not direct assignment) --
// process.env.NODE_ENV is typed read-only by @types/node, and stubEnv is
// the Vitest-native way to override it safely per test.
const ALL_REQUIRED = {
  AUTH_SECRET: "test-secret",
  AUTH_GITHUB_ID: "test-github-id",
  AUTH_GITHUB_SECRET: "test-github-secret",
};

function stubAll(vars: Partial<Record<keyof typeof ALL_REQUIRED, string>>) {
  for (const [key, value] of Object.entries(ALL_REQUIRED)) {
    vi.stubEnv(key, key in vars ? (vars as Record<string, string>)[key] : value);
  }
}

describe("assertProductionAuthConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not throw outside production, regardless of auth configuration", () => {
    vi.stubEnv("NODE_ENV", "development");
    stubAll({ AUTH_SECRET: "", AUTH_GITHUB_ID: "", AUTH_GITHUB_SECRET: "" });
    expect(() => assertProductionAuthConfigured()).not.toThrow();
  });

  it("does not throw in production when every required var is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubAll({});
    expect(() => assertProductionAuthConfigured()).not.toThrow();
  });

  it("throws in production when AUTH_SECRET is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubAll({ AUTH_SECRET: "" });
    expect(() => assertProductionAuthConfigured()).toThrow(/AUTH_SECRET/);
  });

  it("throws in production when AUTH_GITHUB_ID is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubAll({ AUTH_GITHUB_ID: "" });
    expect(() => assertProductionAuthConfigured()).toThrow(/AUTH_GITHUB_ID/);
  });

  it("throws in production when AUTH_GITHUB_SECRET is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubAll({ AUTH_GITHUB_SECRET: "" });
    expect(() => assertProductionAuthConfigured()).toThrow(/AUTH_GITHUB_SECRET/);
  });

  it("lists every missing variable in one error, not just the first", () => {
    vi.stubEnv("NODE_ENV", "production");
    stubAll({ AUTH_SECRET: "", AUTH_GITHUB_ID: "", AUTH_GITHUB_SECRET: "" });
    expect(() => assertProductionAuthConfigured()).toThrow(/AUTH_SECRET.*AUTH_GITHUB_ID.*AUTH_GITHUB_SECRET/);
  });

  it("has no PREAUTH_MODE_ACKNOWLEDGED override -- fully-set-but-real-looking config still passes on its own merits", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PREAUTH_MODE_ACKNOWLEDGED", "true");
    stubAll({ AUTH_SECRET: "" });
    expect(() => assertProductionAuthConfigured()).toThrow(/AUTH_SECRET/);
  });
});
