import { describe, expect, it, vi, afterEach } from "vitest";

// resolveUserId() is tested directly, not through the cache()-wrapped
// requireUserId() export -- see server/context.ts's comment on why.
vi.mock("@/server/auth", () => ({
  auth: vi.fn(),
}));

// next/navigation's real redirect() relies on Next's internal
// request-context machinery, absent in a plain Vitest run -- mocked here
// to both (a) be assertable and (b) throw, matching real redirect()'s own
// always-throws-to-halt-execution behavior, which resolveUserId() relies on.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const { auth } = await import("@/server/auth");
const { resolveUserId } = await import("@/server/context");
const { redirect } = await import("next/navigation");

describe("resolveUserId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(auth).mockReset();
  });

  it("returns the real session's user id when a session exists", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "real-user-123" } } as never);
    await expect(resolveUserId()).resolves.toBe("real-user-123");
  });

  it("falls back to DEV_USER_ID only when NODE_ENV is not production AND the bypass flag is set", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
    await expect(resolveUserId()).resolves.toBe(process.env.DEV_USER_ID);
  });

  it("does NOT fall back to the dev bypass in production, even with the flag set", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "true");
    await expect(resolveUserId()).rejects.toThrow();
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("does NOT fall back to the dev bypass outside production without the flag explicitly set", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "");
    await expect(resolveUserId()).rejects.toThrow();
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects to /sign-in when there is no session and no bypass applies", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_AUTH_BYPASS", "");
    await expect(resolveUserId()).rejects.toThrow();
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
