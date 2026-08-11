import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import {
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  contributeToGoal,
  listSavingsGoals,
  listGoalContributions,
  listAllContributions,
} from "@/server/data/savingsGoals";
import {
  updateSavingsGoalAction,
  deleteSavingsGoalAction,
  contributeToGoalAction,
} from "@/server/actions/savingsGoals";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { DEV_USER_ID, OTHER_USER_ID, resetTestData } from "../setup";

// Same mocking approach as tests/integration/budgets.test.ts.
vi.mock("@/server/context", () => ({
  requireUserId: vi.fn(),
}));

// revalidatePath depends on Next's request-scoped internals, which don't
// exist when calling a Server Action directly under Vitest -- same as
// tests/integration/transaction-actions.test.ts.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function actAs(userId: string) {
  vi.mocked(requireUserId).mockResolvedValue(userId);
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const NONEXISTENT_ID = "clh3ans2z0000356ub9pu9q0m";

// Far enough in the future to never be "overdue" or hit a monthsRemaining=0
// edge case regardless of what day this suite happens to run on.
function farFutureDate(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 5);
  return d.toISOString().slice(0, 10);
}

describe("savings goals DAL", () => {
  beforeEach(async () => {
    await resetTestData();
    actAs(DEV_USER_ID);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("createSavingsGoal", () => {
    it("creates a goal with the default color and no target date", async () => {
      const goal = await createSavingsGoal({ name: "Emergency Fund", targetCents: 500000 });
      expect(goal.name).toBe("Emergency Fund");
      expect(goal.targetCents).toBe(500000);
      expect(goal.startingCents).toBe(0);
      expect(goal.status).toBe("ACTIVE");
      expect(goal.targetDate).toBeNull();
      expect(goal.achievedAt).toBeNull();
      expect(goal.color).toBe("#0ea5e9");
    });

    it("creates a goal with a description, target date, and explicit color", async () => {
      const targetDate = farFutureDate();
      const goal = await createSavingsGoal({
        name: "New Car",
        description: "Down payment",
        targetCents: 1000000,
        targetDate,
        color: "#f97316",
      });
      expect(goal.description).toBe("Down payment");
      expect(goal.targetDate).toBe(targetDate);
      expect(goal.color).toBe("#f97316");
    });

    it("rejects a duplicate name for the same user", async () => {
      await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      await expect(createSavingsGoal({ name: "Trip", targetCents: 200000 })).rejects.toThrow(ValidationError);
    });

    it("allows the same name across different users", async () => {
      await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      actAs(OTHER_USER_ID);
      const theirs = await createSavingsGoal({ name: "Trip", targetCents: 50000 });
      expect(theirs.name).toBe("Trip");
    });

    it("rejects an unknown extra field (mass-assignment guard)", async () => {
      await expect(
        createSavingsGoal({ name: "Trip", targetCents: 100000, userId: "someone-else" }),
      ).rejects.toThrow();
    });
  });

  describe("updateSavingsGoal", () => {
    it("renames a goal and updates its target", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      const updated = await updateSavingsGoal(goal.id, { name: "Trip to Japan", targetCents: 300000 });
      expect(updated.name).toBe("Trip to Japan");
      expect(updated.targetCents).toBe(300000);
    });

    it("sets and then clears the target date", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      const targetDate = farFutureDate();
      const withDate = await updateSavingsGoal(goal.id, { targetDate });
      expect(withDate.targetDate).toBe(targetDate);

      const cleared = await updateSavingsGoal(goal.id, { targetDate: null });
      expect(cleared.targetDate).toBeNull();
    });

    it("clears the description with null", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000, description: "Summer trip" });
      const updated = await updateSavingsGoal(goal.id, { description: null });
      expect(updated.description).toBeNull();
    });

    it("rejects renaming to a name already used by another of the user's goals", async () => {
      await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      const goal = await createSavingsGoal({ name: "Car", targetCents: 100000 });
      await expect(updateSavingsGoal(goal.id, { name: "Trip" })).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError updating a nonexistent goal", async () => {
      await expect(updateSavingsGoal(NONEXISTENT_ID, { name: "x" })).rejects.toThrow(NotFoundError);
    });

    it("cannot update another user's goal, and the row is unmodified", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createSavingsGoal({ name: "Theirs", targetCents: 100000 });

      actAs(DEV_USER_ID);
      await expect(updateSavingsGoal(theirs.id, { name: "Hijacked" })).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.savingsGoal.findUnique({ where: { id: theirs.id } });
      expect(stillThere?.name).toBe("Theirs");
    });
  });

  describe("deleteSavingsGoal", () => {
    it("deletes a goal and its contributions", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      await contributeToGoal(goal.id, { amountCents: 5000, date: "2026-01-15" });

      await deleteSavingsGoal(goal.id);

      expect(await prisma.savingsGoal.findUnique({ where: { id: goal.id } })).toBeNull();
      expect(await prisma.savingsContribution.findFirst({ where: { goalId: goal.id } })).toBeNull();
    });

    it("throws NotFoundError deleting a nonexistent goal", async () => {
      await expect(deleteSavingsGoal(NONEXISTENT_ID)).rejects.toThrow(NotFoundError);
    });

    it("cannot delete another user's goal", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createSavingsGoal({ name: "Theirs", targetCents: 100000 });

      actAs(DEV_USER_ID);
      await expect(deleteSavingsGoal(theirs.id)).rejects.toThrow(NotFoundError);

      actAs(OTHER_USER_ID);
      expect(await prisma.savingsGoal.findUnique({ where: { id: theirs.id } })).not.toBeNull();
    });
  });

  describe("contributeToGoal", () => {
    it("increases currentCents by the contribution amount", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      const result = await contributeToGoal(goal.id, { amountCents: 15000, date: "2026-01-15" });
      expect(result.currentCents).toBe(15000);
      expect(result.remainingCents).toBe(85000);
      expect(result.percentComplete).toBe(15);
      expect(result.isAchieved).toBe(false);
    });

    it("accumulates multiple contributions", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      await contributeToGoal(goal.id, { amountCents: 10000, date: "2026-01-05" });
      const result = await contributeToGoal(goal.id, { amountCents: 20000, date: "2026-01-10" });
      expect(result.currentCents).toBe(30000);
    });

    it("a negative amount (a withdrawal) decreases currentCents", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      await contributeToGoal(goal.id, { amountCents: 20000, date: "2026-01-05" });
      const result = await contributeToGoal(goal.id, { amountCents: -5000, date: "2026-01-10" });
      expect(result.currentCents).toBe(15000);
    });

    it("flips status to ACHIEVED and stamps achievedAt once currentCents reaches the target", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      const result = await contributeToGoal(goal.id, { amountCents: 100000, date: "2026-01-15" });
      expect(result.status).toBe("ACHIEVED");
      expect(result.isAchieved).toBe(true);
      expect(result.achievedAt).not.toBeNull();
    });

    it("achievement is sticky: a later withdrawal below target does not revert to ACTIVE", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      await contributeToGoal(goal.id, { amountCents: 100000, date: "2026-01-15" });
      const afterWithdrawal = await contributeToGoal(goal.id, { amountCents: -50000, date: "2026-01-20" });
      expect(afterWithdrawal.status).toBe("ACHIEVED");
      expect(afterWithdrawal.currentCents).toBe(50000);
    });

    it("clamps remainingCents at 0 for an overfunded goal, without capping percentComplete", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      const result = await contributeToGoal(goal.id, { amountCents: 140000, date: "2026-01-15" });
      expect(result.remainingCents).toBe(0);
      expect(result.percentComplete).toBe(140);
    });

    it("throws NotFoundError contributing to a nonexistent goal", async () => {
      await expect(contributeToGoal(NONEXISTENT_ID, { amountCents: 100, date: "2026-01-15" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("cannot contribute to another user's goal", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createSavingsGoal({ name: "Theirs", targetCents: 100000 });

      actAs(DEV_USER_ID);
      await expect(contributeToGoal(theirs.id, { amountCents: 1000, date: "2026-01-15" })).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("listSavingsGoals", () => {
    it("returns an empty list when there are no goals", async () => {
      expect(await listSavingsGoals()).toEqual([]);
    });

    it("has a null pace when there's no target date", async () => {
      await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      const [goal] = await listSavingsGoals();
      expect(goal.pace).toBeNull();
    });

    it("has a non-null pace when there's a future target date and the goal isn't achieved", async () => {
      await createSavingsGoal({ name: "Trip", targetCents: 100000, targetDate: farFutureDate() });
      const [goal] = await listSavingsGoals();
      expect(goal.pace).not.toBeNull();
      expect(goal.pace!.isOverdue).toBe(false);
    });

    it("has a null pace once a goal (with a target date) is achieved", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000, targetDate: farFutureDate() });
      await contributeToGoal(goal.id, { amountCents: 100000, date: "2026-01-15" });
      const [listed] = await listSavingsGoals();
      expect(listed.isAchieved).toBe(true);
      expect(listed.pace).toBeNull();
    });

    it("never includes another user's goals", async () => {
      actAs(OTHER_USER_ID);
      await createSavingsGoal({ name: "Theirs", targetCents: 100000 });

      actAs(DEV_USER_ID);
      expect(await listSavingsGoals()).toEqual([]);
    });
  });

  describe("listGoalContributions / listAllContributions", () => {
    it("lists a single goal's contributions, most recent date first", async () => {
      const goal = await createSavingsGoal({ name: "Trip", targetCents: 100000 });
      await contributeToGoal(goal.id, { amountCents: 1000, date: "2026-01-05" });
      await contributeToGoal(goal.id, { amountCents: 2000, date: "2026-01-20" });

      const list = await listGoalContributions(goal.id);
      expect(list.map((c) => c.date)).toEqual(["2026-01-20", "2026-01-05"]);
    });

    it("throws NotFoundError listing contributions for a nonexistent goal", async () => {
      await expect(listGoalContributions(NONEXISTENT_ID)).rejects.toThrow(NotFoundError);
    });

    it("cannot list another user's goal contributions", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createSavingsGoal({ name: "Theirs", targetCents: 100000 });
      await contributeToGoal(theirs.id, { amountCents: 1000, date: "2026-01-05" });

      actAs(DEV_USER_ID);
      await expect(listGoalContributions(theirs.id)).rejects.toThrow(NotFoundError);
    });

    it("listAllContributions spans every one of the user's goals", async () => {
      const goalA = await createSavingsGoal({ name: "A", targetCents: 100000 });
      const goalB = await createSavingsGoal({ name: "B", targetCents: 100000 });
      await contributeToGoal(goalA.id, { amountCents: 1000, date: "2026-01-05" });
      await contributeToGoal(goalB.id, { amountCents: 2000, date: "2026-01-10" });

      const all = await listAllContributions();
      expect(all).toHaveLength(2);
      expect(new Set(all.map((c) => c.goalId))).toEqual(new Set([goalA.id, goalB.id]));
    });

    it("listAllContributions never includes another user's contributions", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createSavingsGoal({ name: "Theirs", targetCents: 100000 });
      await contributeToGoal(theirs.id, { amountCents: 1000, date: "2026-01-05" });

      actAs(DEV_USER_ID);
      expect(await listAllContributions()).toEqual([]);
    });
  });

  // Server-Action-level adversarial coverage: proves a forged id in
  // FormData sent through server/actions/savingsGoals.ts never reaches
  // another user's row, mirroring
  // tests/integration/transaction-actions.test.ts's approach one layer
  // above the DAL-level tests above.
  describe("savings goal Server Actions", () => {
    it("cannot update another user's goal via updateSavingsGoalAction, and the row is unmodified", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createSavingsGoal({ name: "Their Fund", targetCents: 500000 });

      actAs(DEV_USER_ID);
      const result = await updateSavingsGoalAction(theirs.id, null, formData({ name: "Hacked", target: "1.00" }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/couldn't be found/i);
      }

      actAs(OTHER_USER_ID);
      const stillThere = await prisma.savingsGoal.findUnique({ where: { id: theirs.id } });
      expect(stillThere?.name).toBe("Their Fund");
    });

    it("cannot delete another user's goal via deleteSavingsGoalAction", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createSavingsGoal({ name: "Their Fund", targetCents: 500000 });

      actAs(DEV_USER_ID);
      const result = await deleteSavingsGoalAction(theirs.id, null);
      expect(result.ok).toBe(false);

      actAs(OTHER_USER_ID);
      expect(await prisma.savingsGoal.findUnique({ where: { id: theirs.id } })).not.toBeNull();
    });

    it("cannot contribute to another user's goal via contributeToGoalAction, and no contribution is created", async () => {
      actAs(OTHER_USER_ID);
      const theirs = await createSavingsGoal({ name: "Their Fund", targetCents: 500000 });

      actAs(DEV_USER_ID);
      const result = await contributeToGoalAction(
        theirs.id,
        null,
        formData({ amount: "50.00", direction: "DEPOSIT", date: "2026-03-10" }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/couldn't be found/i);
      }

      const contributions = await prisma.savingsContribution.findMany({ where: { goalId: theirs.id } });
      expect(contributions).toHaveLength(0);
    });
  });
});
