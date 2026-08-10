import { describe, expect, it, vi, afterEach } from "vitest";
import { assertNotUnguardedProduction } from "@/server/env";

// Exercises the pre-auth production guard as a standalone function call
// against stubbed process.env, not by re-triggering server/env.ts's own
// module-level `loadServerEnv()` -- that already ran once at first import
// (using this test run's real env, where NODE_ENV="test") and its result is
// cached in the exported `serverEnv`, same as every other test file that
// transitively imports server/env.ts. vi.stubEnv (not direct assignment) --
// process.env.NODE_ENV is typed read-only by @types/node, and stubEnv is
// the Vitest-native way to override it safely per test.
describe("assertNotUnguardedProduction", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not throw outside production, regardless of the acknowledgment", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PREAUTH_MODE_ACKNOWLEDGED", "");
    expect(() => assertNotUnguardedProduction()).not.toThrow();
  });

  it("throws in production without the acknowledgment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PREAUTH_MODE_ACKNOWLEDGED", "");
    expect(() => assertNotUnguardedProduction()).toThrow(/pre-auth|authentication/i);
  });

  it("throws in production when the acknowledgment is any value other than the literal string 'true'", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PREAUTH_MODE_ACKNOWLEDGED", "yes");
    expect(() => assertNotUnguardedProduction()).toThrow();
  });

  it("does not throw in production when explicitly acknowledged", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PREAUTH_MODE_ACKNOWLEDGED", "true");
    expect(() => assertNotUnguardedProduction()).not.toThrow();
  });
});
