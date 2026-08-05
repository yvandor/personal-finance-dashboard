"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createBudget, updateBudget, deleteBudget, type BudgetDTO } from "@/server/data/budgets";
import { parseMoneyToCents } from "@/lib/money";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { ActionResult } from "@/lib/result";

// Thin by design, mirroring server/actions/transactions.ts: extract
// FormData -> call the DAL (which re-validates with the existing Zod
// schemas and re-derives the owner from the session) -> revalidate -> shape
// the result. No userId is ever read from `formData`.

const BUDGETS_PATH = "/budgets";
const DASHBOARD_PATH = "/dashboard";

function errorResult(message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error: message, fieldErrors };
}

// Maps a thrown error to a client-safe result -- only ever forwards
// messages from error types thrown ourselves for expected, input-shaped
// problems, never a raw caught error's message (could name columns or leak
// internals).
function toErrorResult(err: unknown): ActionResult<never> {
  if (err instanceof z.ZodError) {
    const fieldErrors = err.flatten().fieldErrors as Record<string, string[]>;
    return errorResult("Please fix the highlighted fields.", fieldErrors);
  }
  if (err instanceof NotFoundError) {
    return errorResult("That budget or category couldn't be found.");
  }
  if (err instanceof ValidationError) {
    return errorResult(err.message);
  }
  console.error("Unexpected error in a budget action:", err);
  return errorResult("Something went wrong. Please try again.");
}

function extractAmountCents(formData: FormData): { ok: true; amountCents: number } | { ok: false; result: ActionResult<never> } {
  const amountRaw = formData.get("amount");
  try {
    return { ok: true, amountCents: parseMoneyToCents(typeof amountRaw === "string" ? amountRaw : "") };
  } catch {
    return {
      ok: false,
      result: errorResult("Please fix the highlighted fields.", {
        amount: ["Enter a valid amount, like 250.00."],
      }),
    };
  }
}

function revalidateBudgetPaths(): void {
  revalidatePath(BUDGETS_PATH);
  revalidatePath(DASHBOARD_PATH);
}

export async function createBudgetAction(
  _prevState: ActionResult<BudgetDTO> | null,
  formData: FormData,
): Promise<ActionResult<BudgetDTO>> {
  const extracted = extractAmountCents(formData);
  if (!extracted.ok) return extracted.result;

  try {
    const created = await createBudget({
      categoryId: formData.get("categoryId"),
      month: formData.get("month"),
      amountCents: extracted.amountCents,
      notes: formData.get("notes") || undefined,
    });
    revalidateBudgetPaths();
    return { ok: true, data: created };
  } catch (err) {
    return toErrorResult(err);
  }
}

export async function updateBudgetAction(
  id: string,
  _prevState: ActionResult<BudgetDTO> | null,
  formData: FormData,
): Promise<ActionResult<BudgetDTO>> {
  const extracted = extractAmountCents(formData);
  if (!extracted.ok) return extracted.result;

  try {
    const updated = await updateBudget(id, {
      amountCents: extracted.amountCents,
      notes: formData.get("notes") || undefined,
    });
    revalidateBudgetPaths();
    return { ok: true, data: updated };
  } catch (err) {
    return toErrorResult(err);
  }
}

export async function deleteBudgetAction(
  id: string,
  // Required by useActionState's calling convention even though delete
  // doesn't need the previous result.
  prevState: ActionResult<void> | null,
): Promise<ActionResult<void>> {
  void prevState;
  try {
    await deleteBudget(id);
    revalidateBudgetPaths();
    return { ok: true, data: undefined };
  } catch (err) {
    return toErrorResult(err);
  }
}
