import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked before importing @/server/authEvents so handleUserCreated calls a
// spy, not a real DB write. authEvents.ts is deliberately separate from
// server/auth.ts (which constructs NextAuth(...) and pulls in next-auth's
// own Next.js internals) specifically so this can be tested without that
// -- see authEvents.ts's own comment.
const seedDefaultCategories = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/data/categories", () => ({ seedDefaultCategories }));

describe("server/authEvents.ts handleUserCreated", () => {
  beforeEach(() => {
    seedDefaultCategories.mockClear();
  });

  it("seeds default categories for the newly created user's id", async () => {
    const { handleUserCreated } = await import("@/server/authEvents");
    await handleUserCreated({ user: { id: "brand-new-user-id" } });
    expect(seedDefaultCategories).toHaveBeenCalledTimes(1);
    expect(seedDefaultCategories).toHaveBeenCalledWith("brand-new-user-id");
  });

  it("does nothing when the user has no id", async () => {
    const { handleUserCreated } = await import("@/server/authEvents");
    await handleUserCreated({ user: {} });
    expect(seedDefaultCategories).not.toHaveBeenCalled();
  });
});
