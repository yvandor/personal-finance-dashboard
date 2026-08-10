"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createIncomeSource,
  updateIncomeSource,
  archiveIncomeSource,
  unarchiveIncomeSource,
  type IncomeSourceDTO,
} from "@/server/data/incomeSources";
import { parseMoneyToCents } from "@/lib/money";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { ActionResult } from "@/lib/result";

// Thin by design, mirroring server/actions/categories.ts: extract FormData
// -> call the DAL (which re-validates with the existing Zod schemas and
// re-derives the owner from the session) -> revalidate every route that
// renders an income source picker -> shape the result.

const INCOME_PATH = "/income";
// The transaction form's Source dropdown is the only other picker fed by
// listIncomeSources() -- same reasoning as
// server/actions/categories.ts's PATHS_WITH_CATEGORY_PICKERS.
const PATHS_WITH_INCOME_SOURCE_PICKERS = ["/transactions"];

function errorResult(message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error: message, fieldErrors };
}

function toErrorResult(err: unknown): ActionResult<never> {
  if (err instanceof z.ZodError) {
    const fieldErrors = err.flatten().fieldErrors as Record<string, string[]>;
    return errorResult("Please fix the highlighted fields.", fieldErrors);
  }
  if (err instanceof NotFoundError) {
    return errorResult("That income source couldn't be found.");
  }
  if (err instanceof ValidationError) {
    return errorResult(err.message);
  }
  console.error("Unexpected error in an income source action:", err);
  return errorResult("Something went wrong. Please try again.");
}

function revalidateIncomeSourcePaths(): void {
  revalidatePath(INCOME_PATH);
  for (const path of PATHS_WITH_INCOME_SOURCE_PICKERS) {
    revalidatePath(path);
  }
}

// Extracted separately from Zod parsing so a bad amount string produces a
// field-specific error ("amount") rather than falling through to the DAL's
// generic Zod failure -- same pattern as
// server/actions/budgets.ts's extractAmountCents.
function extractAmountCents(formData: FormData): { ok: true; amountCents: number } | { ok: false; result: ActionResult<never> } {
  const amountRaw = formData.get("amount");
  try {
    return { ok: true, amountCents: parseMoneyToCents(typeof amountRaw === "string" ? amountRaw : "") };
  } catch {
    return {
      ok: false,
      result: errorResult("Please fix the highlighted fields.", {
        amount: ["Enter a valid amount, like 2500.00."],
      }),
    };
  }
}

// payDay comes from a plain numeric input, not a money string -- an
// out-of-range or missing value is left for the DAL's Zod schema to reject
// with its own field error, same as e.g. categoryId elsewhere.
function readPayDay(formData: FormData): number | undefined {
  const raw = formData.get("payDay");
  if (raw === null || raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function createIncomeSourceAction(
  _prevState: ActionResult<IncomeSourceDTO> | null,
  formData: FormData,
): Promise<ActionResult<IncomeSourceDTO>> {
  const extracted = extractAmountCents(formData);
  if (!extracted.ok) return extracted.result;

  try {
    const created = await createIncomeSource({
      name: formData.get("name"),
      amountCents: extracted.amountCents,
      payDay: readPayDay(formData),
      notes: formData.get("notes") || undefined,
    });
    revalidateIncomeSourcePaths();
    return { ok: true, data: created };
  } catch (err) {
    return toErrorResult(err);
  }
}

export async function updateIncomeSourceAction(
  id: string,
  _prevState: ActionResult<IncomeSourceDTO> | null,
  formData: FormData,
): Promise<ActionResult<IncomeSourceDTO>> {
  const extracted = extractAmountCents(formData);
  if (!extracted.ok) return extracted.result;

  try {
    const updated = await updateIncomeSource(id, {
      name: formData.get("name") || undefined,
      amountCents: extracted.amountCents,
      payDay: readPayDay(formData),
      notes: formData.get("notes") || undefined,
    });
    revalidateIncomeSourcePaths();
    return { ok: true, data: updated };
  } catch (err) {
    return toErrorResult(err);
  }
}

export async function archiveIncomeSourceAction(
  id: string,
  // Required by useActionState's calling convention even though this
  // action doesn't need the previous result.
  prevState: ActionResult<void> | null,
): Promise<ActionResult<void>> {
  void prevState;
  try {
    await archiveIncomeSource(id);
    revalidateIncomeSourcePaths();
    return { ok: true, data: undefined };
  } catch (err) {
    return toErrorResult(err);
  }
}

export async function unarchiveIncomeSourceAction(
  id: string,
  prevState: ActionResult<void> | null,
): Promise<ActionResult<void>> {
  void prevState;
  try {
    await unarchiveIncomeSource(id);
    revalidateIncomeSourcePaths();
    return { ok: true, data: undefined };
  } catch (err) {
    return toErrorResult(err);
  }
}
