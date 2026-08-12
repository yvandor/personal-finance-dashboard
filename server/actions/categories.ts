"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
  type CategoryDTO,
} from "@/server/data/categories";
import { NotFoundError, ValidationError, RateLimitError } from "@/lib/errors";
import { reportUnexpectedActionError } from "@/server/logger";
import { enforceMutationRateLimit } from "@/server/rateLimit";
import type { ActionResult } from "@/lib/result";

// Thin by design, mirroring server/actions/budgets.ts: extract FormData ->
// call the DAL (which re-validates with the existing Zod schemas and
// re-derives the owner from the session) -> revalidate every route that
// renders a category picker -> shape the result.

const CATEGORIES_PATH = "/categories";
// Every page that lists categories via listCategories() needs
// revalidating too, or a freshly created/archived category wouldn't show
// up (or wouldn't disappear) until its own next unrelated revalidation.
const PATHS_WITH_CATEGORY_PICKERS = ["/transactions", "/budgets", "/dashboard"];

function errorResult(message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error: message, fieldErrors };
}

function toErrorResult(err: unknown, actionName: string): ActionResult<never> {
  if (err instanceof z.ZodError) {
    const fieldErrors = err.flatten().fieldErrors as Record<string, string[]>;
    return errorResult("Please fix the highlighted fields.", fieldErrors);
  }
  if (err instanceof NotFoundError) {
    return errorResult("That category couldn't be found.");
  }
  if (err instanceof ValidationError) {
    return errorResult(err.message);
  }
  if (err instanceof RateLimitError) {
    return errorResult(err.message);
  }
  reportUnexpectedActionError(actionName, err);
  return errorResult("Something went wrong. Please try again.");
}

function revalidateCategoryPaths(): void {
  revalidatePath(CATEGORIES_PATH);
  for (const path of PATHS_WITH_CATEGORY_PICKERS) {
    revalidatePath(path);
  }
}

export async function createCategoryAction(
  _prevState: ActionResult<CategoryDTO> | null,
  formData: FormData,
): Promise<ActionResult<CategoryDTO>> {
  try {
    await enforceMutationRateLimit("createCategoryAction");
    const created = await createCategory({
      name: formData.get("name"),
      type: formData.get("type"),
      color: formData.get("color") || undefined,
    });
    revalidateCategoryPaths();
    return { ok: true, data: created };
  } catch (err) {
    return toErrorResult(err, "createCategoryAction");
  }
}

export async function updateCategoryAction(
  id: string,
  _prevState: ActionResult<CategoryDTO> | null,
  formData: FormData,
): Promise<ActionResult<CategoryDTO>> {
  try {
    await enforceMutationRateLimit("updateCategoryAction");
    const updated = await updateCategory(id, {
      name: formData.get("name") || undefined,
      color: formData.get("color") || undefined,
    });
    revalidateCategoryPaths();
    return { ok: true, data: updated };
  } catch (err) {
    return toErrorResult(err, "updateCategoryAction");
  }
}

export async function archiveCategoryAction(
  id: string,
  // Required by useActionState's calling convention even though this
  // action doesn't need the previous result.
  prevState: ActionResult<void> | null,
): Promise<ActionResult<void>> {
  void prevState;
  try {
    await enforceMutationRateLimit("archiveCategoryAction");
    await archiveCategory(id);
    revalidateCategoryPaths();
    return { ok: true, data: undefined };
  } catch (err) {
    return toErrorResult(err, "archiveCategoryAction");
  }
}

export async function unarchiveCategoryAction(
  id: string,
  prevState: ActionResult<void> | null,
): Promise<ActionResult<void>> {
  void prevState;
  try {
    await enforceMutationRateLimit("unarchiveCategoryAction");
    await unarchiveCategory(id);
    revalidateCategoryPaths();
    return { ok: true, data: undefined };
  } catch (err) {
    return toErrorResult(err, "unarchiveCategoryAction");
  }
}
