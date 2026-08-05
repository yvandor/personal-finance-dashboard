import "server-only";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/context";
import type { Category } from "@/app/generated/prisma/client";
import type { CategoryType } from "@/app/generated/prisma/enums";

// Read-only. Full category management (create/rename/archive) is a later
// phase — this exists only so the transaction form has real categories to
// select from, and so filtering can offer real options. Categories
// currently only come from prisma/seed.ts.

export interface CategoryDTO {
  id: string;
  type: CategoryType;
  name: string;
  color: string;
}

function toDTO(row: Category): CategoryDTO {
  return { id: row.id, type: row.type, name: row.name, color: row.color };
}

export async function listCategories(): Promise<CategoryDTO[]> {
  const userId = await requireUserId();
  const rows = await prisma.category.findMany({
    where: { userId, isArchived: false },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(toDTO);
}
