import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NotFoundError } from "@/lib/errors";

// The end-to-end version of tests/unit/logger.test.ts's claim: drive a real
// Server Action into its unexpected-error branch and check both halves of
// the contract at once -- exactly one structured line goes to the log, and
// the ActionResult that reaches the client carries none of the error's
// internals. Those two are tested together deliberately: the failure mode
// this guards against is a "helpful" change that surfaces the underlying
// message in one place while sanitizing the other.
//
// The DAL is mocked rather than driven against a real database, matching
// tests/unit/require-user-id.test.ts's approach -- the action's error
// mapping is the subject here, not any query.
vi.mock("@/server/data/categories", () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  archiveCategory: vi.fn(),
  unarchiveCategory: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { createCategory } = await import("@/server/data/categories");
const { createCategoryAction, archiveCategoryAction } = await import("@/server/actions/categories");

// Prisma-shaped: a real PrismaClientKnownRequestError's own `.message` can
// quote the failing query and its bound parameters, and `meta` holds more
// of the same -- see docs/PROJECT_PLAN.md §8's "Prisma errors can include
// query fragments and parameter values."
function prismaLikeError() {
  return Object.assign(new Error('Invalid `prisma.category.create()` invocation:\n  amountCents: 125099'), {
    name: "PrismaClientKnownRequestError",
    code: "P2002",
    meta: { target: ["userId", "name"], description: "Therapy session" },
    stack: "Error: Invalid `prisma.category.create()`\n    at /var/task/.next/server/chunks/1234.js:5:6",
  });
}

function formData(): FormData {
  const fd = new FormData();
  fd.set("name", "Groceries");
  fd.set("type", "EXPENSE");
  return fd;
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(createCategory).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Server Action unexpected-error path", () => {
  it("emits exactly one structured log line naming the action that failed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(createCategory).mockRejectedValue(prismaLikeError());

    await createCategoryAction(null, formData());

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      event: "action.unexpected_error",
      level: "error",
      actionName: "createCategoryAction",
      errorName: "PrismaClientKnownRequestError",
    });
    expect(typeof line.correlationId).toBe("string");
  });

  it("puts no Prisma internals, parameter values, or stack frames in that line", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(createCategory).mockRejectedValue(prismaLikeError());

    await createCategoryAction(null, formData());

    const raw = logSpy.mock.calls[0][0] as string;
    expect(raw).not.toContain("125099");
    expect(raw).not.toContain("Therapy session");
    expect(raw).not.toContain("prisma.category.create");
    expect(raw).not.toContain("P2002");
    expect(raw).not.toContain(".next/server");
    expect(raw).not.toContain("at /var/task");
  });

  it("returns a generic ActionResult with no stack trace or internal detail", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(createCategory).mockRejectedValue(prismaLikeError());

    const result = await createCategoryAction(null, formData());

    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again.", fieldErrors: undefined });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("125099");
    expect(serialized).not.toContain("Therapy session");
    expect(serialized).not.toContain("prisma");
    expect(serialized).not.toContain("P2002");
    expect(serialized).not.toContain("at /var/task");
  });

  it("logs nothing for an expected NotFoundError -- those are ordinary return values, not failures", async () => {
    const { archiveCategory } = await import("@/server/data/categories");
    vi.mocked(archiveCategory).mockRejectedValue(new NotFoundError("Category not found"));

    const result = await archiveCategoryAction("cat_1", null);

    expect(result).toEqual({ ok: false, error: "That category couldn't be found.", fieldErrors: undefined });
    expect(logSpy).not.toHaveBeenCalled();
  });
});
