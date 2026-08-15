import "server-only";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { authzDenied } from "@/server/logger";
import { categoryCreateSchema, categoryUpdateSchema } from "@/lib/schemas/category";
import { DEFAULT_CATEGORIES } from "@/lib/defaultCategories";
import type { Category } from "@/app/generated/prisma/client";
import type { CategoryType } from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";

// server/data/categories.ts is the only place `prisma.category` (and its
// relations) is touched -- same invariant as every other DAL module. Reads
// used by pickers (listCategories) stay separate from the management-page
// reads/writes added below, so a picker's shape/behavior can't accidentally
// change as a side effect of building category management.

export interface CategoryDTO {
  id: string;
  type: CategoryType;
  name: string;
  color: string;
}

function toDTO(row: Category): CategoryDTO {
  return { id: row.id, type: row.type, name: row.name, color: row.color };
}

/** Active categories only -- feeds every picker (transaction form, budget form, filters). */
export async function listCategories(): Promise<CategoryDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.category.findMany({
    where: { userId, isArchived: false },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(toDTO);
}

export interface CategoryManagementDTO extends CategoryDTO {
  isArchived: boolean;
  isSystem: boolean;
  /** Transactions currently filed under this category -- informational only; archiving is never blocked by this. */
  transactionCount: number;
}

// Includes archived categories (the management page has its own
// active/archived sections) and a transaction count so the UI can explain
// *why* archiving (not deleting) is the only removal action for a category
// that's in use -- see the isArchived column's own comment in
// prisma/schema.prisma and server/data/budgets.ts's comment on why a real
// prisma.category.delete() is never used here.
export async function listCategoriesForManagement(): Promise<CategoryManagementDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.category.findMany({
    where: { userId },
    orderBy: [{ isArchived: "asc" }, { type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { transactions: true } } },
  });
  return rows.map((row) => ({ ...toDTO(row), isArchived: row.isArchived, isSystem: row.isSystem, transactionCount: row._count.transactions }));
}

function toValidationError(err: unknown): never {
  // The `[userId, type, name]` unique index (see the migration) is the real
  // enforcement of "name unique per user, per type" -- same
  // catch-P2002-and-translate pattern as server/data/budgets.ts's
  // createBudget.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new ValidationError("A category with this name already exists.");
  }
  throw err;
}

// Seeds the standard starter categories (lib/defaultCategories.ts) for a
// single user. Takes an explicit userId rather than requireUserId() because
// its two real callers -- server/auth.ts's events.createUser (fired by
// Auth.js during the OAuth callback, no request-scoped session yet for the
// user being created) and scripts/backfill-default-categories.ts (a
// standalone process) -- never have an active session to resolve.
//
// Idempotent and concurrency-safe by construction, not by a manual
// check-then-insert: createMany + skipDuplicates compiles to a single
// INSERT ... ON CONFLICT DO NOTHING, which the categories table's existing
// `@@unique([userId, type, name])` constraint (prisma/schema.prisma) makes
// safe under real concurrent calls for the same user -- two overlapping
// invocations race at the database, not in application code, and neither
// errors nor duplicates. It's also safe to call for a user who already has
// some categories: any name/type that already exists (including a custom
// category that happens to share a default's name) is silently skipped,
// never overwritten -- this only ever fills in what's missing.
export async function seedDefaultCategories(userId: string): Promise<void> {
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      userId,
      name: c.name,
      type: c.type,
      isSystem: true,
      sortOrder: c.sortOrder,
    })),
    skipDuplicates: true,
  });
}

export async function createCategory(input: unknown): Promise<CategoryDTO> {
  const userId = await requireUserId();
  const data = categoryCreateSchema.parse(input);

  try {
    const created = await prisma.category.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        color: data.color,
      },
    });
    return toDTO(created);
  } catch (err) {
    return toValidationError(err);
  }
}

// Type is deliberately not editable -- same reasoning as Budget's
// category/month fields (see lib/schemas/budget.ts): changing the type of
// an in-use category would silently invalidate the very budgets/pickers
// that assumed it, so retiring one type and creating a fresh category is
// the supported path instead of a live type swap.
export async function updateCategory(id: string, input: unknown): Promise<CategoryDTO> {
  const userId = await requireUserId();
  const data = categoryUpdateSchema.parse(input);

  try {
    const result = await prisma.category.updateMany({
      where: { id, userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      },
    });
    if (result.count === 0) {
      throw authzDenied("category", id);
    }
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    return toValidationError(err);
  }

  const updated = await prisma.category.findFirst({ where: { id, userId } });
  if (!updated) {
    throw authzDenied("category", id);
  }
  return toDTO(updated);
}

async function setArchived(id: string, isArchived: boolean): Promise<void> {
  const userId = await requireUserId();
  const result = await prisma.category.updateMany({ where: { id, userId }, data: { isArchived } });
  if (result.count === 0) {
    throw authzDenied("category", id);
  }
}

// Archiving (never a real prisma.category.delete()) is the only removal
// action this app exposes for a category, whether or not it's in use --
// see prisma/schema.prisma's comment on isArchived and
// server/data/budgets.ts's comment on why Budget's onDelete: Cascade makes
// a hard delete dangerous. Archived categories drop out of every picker
// (listCategories filters isArchived: false) but stay fully intact for
// every transaction/budget that already references them -- "a label
// deletion must never delete financial history" (docs/PROJECT_PLAN.md's
// Categories AC), satisfied unconditionally rather than only when unused.
export async function archiveCategory(id: string): Promise<void> {
  return setArchived(id, true);
}

export async function unarchiveCategory(id: string): Promise<void> {
  return setArchived(id, false);
}
