import "server-only";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  savingsContributionCreateSchema,
} from "@/lib/schemas/savingsGoal";
import { computeGoalPace, type GoalPace } from "@/lib/savingsGoals";
import type { GoalStatus } from "@/app/generated/prisma/enums";
import type { SavingsGoal, SavingsContribution } from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";

// This module is the ONLY place `prisma.savingsGoal`/`prisma.savingsContribution`
// is touched -- same invariant as every other DAL module. Deleting a goal is
// a real prisma.savingsGoal.delete() (cascading its own contributions),
// unlike server/data/categories.ts's archive-only policy: a goal's
// contributions are its own self-contained ledger, independent of the
// transaction ledger (see prisma/schema.prisma's comment on
// SavingsContribution and docs/PROJECT_PLAN.md's Savings Goals AC), so
// deleting a goal can never orphan or silently affect a transaction the way
// deleting a category could.

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface SavingsGoalDTO {
  id: string;
  name: string;
  description: string | null;
  targetCents: number;
  startingCents: number;
  targetDate: string | null;
  status: GoalStatus;
  color: string;
  achievedAt: string | null;
  createdAt: string;
}

export interface SavingsGoalProgressDTO extends SavingsGoalDTO {
  currentCents: number;
  /** targetCents - currentCents, floored at 0 for display -- an overfunded goal never shows a negative "remaining." */
  remainingCents: number;
  /** Rounded; NOT capped at 100, so a genuinely overfunded goal reads e.g. 140 (see BudgetProgressDTO's identical convention). */
  percentComplete: number;
  isAchieved: boolean;
  /** null when there's no targetDate to pace against, or the goal is already achieved. */
  pace: GoalPace | null;
}

export interface ContributionDTO {
  id: string;
  goalId: string;
  amountCents: number;
  date: string;
  note: string | null;
  createdAt: string;
}

function toDTO(row: SavingsGoal): SavingsGoalDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    targetCents: row.targetCents,
    startingCents: row.startingCents,
    targetDate: row.targetDate ? toDateOnly(row.targetDate) : null,
    status: row.status,
    color: row.color,
    achievedAt: row.achievedAt ? row.achievedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProgressDTO(row: SavingsGoal, currentCents: number, now: Date): SavingsGoalProgressDTO {
  const remainingCents = Math.max(row.targetCents - currentCents, 0);
  const percentComplete =
    row.targetCents > 0 ? Math.round((currentCents / row.targetCents) * 100) : currentCents > 0 ? 100 : 0;
  const isAchieved = row.status === "ACHIEVED";

  const pace =
    !isAchieved && row.targetDate
      ? computeGoalPace({
          targetDate: row.targetDate,
          createdAt: row.createdAt,
          startingCents: row.startingCents,
          currentCents,
          remainingCents,
          now,
        })
      : null;

  return { ...toDTO(row), currentCents, remainingCents, percentComplete, isAchieved, pace };
}

function toContributionDTO(row: SavingsContribution): ContributionDTO {
  return {
    id: row.id,
    goalId: row.goalId,
    amountCents: row.amountCents,
    date: toDateOnly(row.date),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

// One query for the goals, one groupBy for every goal's contribution sum,
// joined in memory -- avoids an N+1 query per goal, same shape as
// server/data/budgets.ts's listBudgetsWithProgress.
export async function listSavingsGoals(): Promise<SavingsGoalProgressDTO[]> {
  const userId = await requireUserId();
  const [goals, sums] = await Promise.all([
    prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.savingsContribution.groupBy({ by: ["goalId"], where: { userId }, _sum: { amountCents: true } }),
  ]);

  const sumByGoalId = new Map(sums.map((s) => [s.goalId, s._sum.amountCents ?? 0]));
  const now = new Date();
  return goals.map((g) => toProgressDTO(g, g.startingCents + (sumByGoalId.get(g.id) ?? 0), now));
}

// All of the user's contributions across every goal, in one query -- backs
// the /goals page's contribution-history disclosure on each card. At this
// app's scale (a handful of goals, a modest contribution count each) this
// is cheaper and simpler than a per-card fetch triggered on demand, and it
// keeps /goals a plain Server Component that awaits the DAL directly, same
// as every other page (see app/(dashboard)/goals/page.tsx).
export async function listAllContributions(): Promise<ContributionDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.savingsContribution.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toContributionDTO);
}

export async function listGoalContributions(goalId: string): Promise<ContributionDTO[]> {
  const userId = await requireUserId();
  const goal = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) {
    throw new NotFoundError("Savings goal not found");
  }
  const rows = await prisma.savingsContribution.findMany({
    where: { goalId, userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toContributionDTO);
}

// The `[userId, name]` unique index (see the migration) is the real
// enforcement of "name unique per user" -- same catch-P2002-and-translate
// pattern as server/data/budgets.ts's createBudget and
// server/data/categories.ts's createCategory.
function toValidationError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new ValidationError("A savings goal with this name already exists.");
  }
  throw err;
}

export async function createSavingsGoal(input: unknown): Promise<SavingsGoalDTO> {
  const userId = await requireUserId();
  const data = savingsGoalCreateSchema.parse(input);

  try {
    const created = await prisma.savingsGoal.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        targetCents: data.targetCents,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        color: data.color,
      },
    });
    return toDTO(created);
  } catch (err) {
    return toValidationError(err);
  }
}

export async function updateSavingsGoal(id: string, input: unknown): Promise<SavingsGoalDTO> {
  const userId = await requireUserId();
  const data = savingsGoalUpdateSchema.parse(input);

  // `updateMany` (not `update`) so the ownership check is part of the
  // query's `where` -- same pattern as every other DAL's update function.
  try {
    const result = await prisma.savingsGoal.updateMany({
      where: { id, userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.targetCents !== undefined ? { targetCents: data.targetCents } : {}),
        ...(data.targetDate !== undefined ? { targetDate: data.targetDate ? new Date(data.targetDate) : null } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      },
    });
    if (result.count === 0) {
      throw new NotFoundError("Savings goal not found");
    }
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    return toValidationError(err);
  }

  const updated = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!updated) {
    throw new NotFoundError("Savings goal not found");
  }
  return toDTO(updated);
}

export async function deleteSavingsGoal(id: string): Promise<void> {
  const userId = await requireUserId();
  // Explicit, not relied-upon-via-cascade -- same discipline as
  // tests/setup.ts's resetTestData: contributions are deleted before the
  // goal itself, rather than trusting SavingsContribution.goalId's
  // onDelete: Cascade to always keep doing this for us.
  await prisma.savingsContribution.deleteMany({ where: { goalId: id, userId } });
  const result = await prisma.savingsGoal.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new NotFoundError("Savings goal not found");
  }
}

// Records a contribution (or, with a negative amount, a withdrawal -- see
// prisma/schema.prisma) and, if it pushes the goal to or past its target,
// flips status to ACHIEVED and stamps achievedAt. That transition is
// deliberately one-way: a later withdrawal that drops currentCents back
// below target does NOT revert an already-ACHIEVED goal to ACTIVE -- once
// reached, a goal stays reached, the same way this app doesn't retroactively
// un-congratulate a milestone. Editing targetCents upward on an ACHIEVED
// goal similarly does not revert it; achievement is only ever set here, by
// an actual contribution crossing the line at the time it was recorded.
export async function contributeToGoal(goalId: string, input: unknown): Promise<SavingsGoalProgressDTO> {
  const userId = await requireUserId();
  const data = savingsContributionCreateSchema.parse(input);

  const goal = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) {
    throw new NotFoundError("Savings goal not found");
  }

  await prisma.savingsContribution.create({
    data: { userId, goalId, amountCents: data.amountCents, date: new Date(data.date), note: data.note },
  });

  const sum = await prisma.savingsContribution.aggregate({
    where: { goalId, userId },
    _sum: { amountCents: true },
  });
  const currentCents = goal.startingCents + (sum._sum.amountCents ?? 0);

  let finalGoal = goal;
  if (goal.status === "ACTIVE" && currentCents >= goal.targetCents) {
    const now = new Date();
    await prisma.savingsGoal.updateMany({ where: { id: goalId, userId }, data: { status: "ACHIEVED", achievedAt: now } });
    finalGoal = { ...goal, status: "ACHIEVED", achievedAt: now };
  }

  return toProgressDTO(finalGoal, currentCents, new Date());
}
