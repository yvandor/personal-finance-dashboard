"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  contributeToGoal,
  type SavingsGoalDTO,
  type SavingsGoalProgressDTO,
} from "@/server/data/savingsGoals";
import { parseMoneyToCents } from "@/lib/money";
import { NotFoundError, ValidationError, RateLimitError } from "@/lib/errors";
import { reportUnexpectedActionError } from "@/server/logger";
import { enforceMutationRateLimit } from "@/server/rateLimit";
import type { ActionResult } from "@/lib/result";

// Thin by design, mirroring server/actions/budgets.ts.

const GOALS_PATH = "/goals";

function errorResult(message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error: message, fieldErrors };
}

function toErrorResult(err: unknown, actionName: string): ActionResult<never> {
  if (err instanceof z.ZodError) {
    const fieldErrors = err.flatten().fieldErrors as Record<string, string[]>;
    return errorResult("Please fix the highlighted fields.", fieldErrors);
  }
  if (err instanceof NotFoundError) {
    return errorResult("That savings goal couldn't be found.");
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

function extractAmountCents(
  formData: FormData,
  field: string,
  friendlyExample: string,
): { ok: true; amountCents: number } | { ok: false; result: ActionResult<never> } {
  const raw = formData.get(field);
  try {
    return { ok: true, amountCents: parseMoneyToCents(typeof raw === "string" ? raw : "") };
  } catch {
    return {
      ok: false,
      result: errorResult("Please fix the highlighted fields.", {
        [field]: [`Enter a valid amount, like ${friendlyExample}.`],
      }),
    };
  }
}

export async function createSavingsGoalAction(
  _prevState: ActionResult<SavingsGoalDTO> | null,
  formData: FormData,
): Promise<ActionResult<SavingsGoalDTO>> {
  const extracted = extractAmountCents(formData, "target", "5,000.00");
  if (!extracted.ok) return extracted.result;

  try {
    await enforceMutationRateLimit("createSavingsGoalAction");
    const created = await createSavingsGoal({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      targetCents: extracted.amountCents,
      targetDate: formData.get("targetDate") || undefined,
      color: formData.get("color") || undefined,
    });
    revalidatePath(GOALS_PATH);
    return { ok: true, data: created };
  } catch (err) {
    return toErrorResult(err, "createSavingsGoalAction");
  }
}

export async function updateSavingsGoalAction(
  id: string,
  _prevState: ActionResult<SavingsGoalDTO> | null,
  formData: FormData,
): Promise<ActionResult<SavingsGoalDTO>> {
  const extracted = extractAmountCents(formData, "target", "5,000.00");
  if (!extracted.ok) return extracted.result;

  const targetDateRaw = formData.get("targetDate");

  try {
    await enforceMutationRateLimit("updateSavingsGoalAction");
    const updated = await updateSavingsGoal(id, {
      name: formData.get("name"),
      description: formData.get("description") || null,
      targetCents: extracted.amountCents,
      // An empty string from a cleared date input means "remove the target
      // date" (null), distinct from the field being absent entirely.
      targetDate: targetDateRaw === "" ? null : (targetDateRaw ?? undefined),
      color: formData.get("color") || undefined,
    });
    revalidatePath(GOALS_PATH);
    return { ok: true, data: updated };
  } catch (err) {
    return toErrorResult(err, "updateSavingsGoalAction");
  }
}

export async function deleteSavingsGoalAction(
  id: string,
  prevState: ActionResult<void> | null,
): Promise<ActionResult<void>> {
  void prevState;
  try {
    await enforceMutationRateLimit("deleteSavingsGoalAction");
    await deleteSavingsGoal(id);
    revalidatePath(GOALS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toErrorResult(err, "deleteSavingsGoalAction");
  }
}

export async function contributeToGoalAction(
  id: string,
  _prevState: ActionResult<SavingsGoalProgressDTO> | null,
  formData: FormData,
): Promise<ActionResult<SavingsGoalProgressDTO>> {
  const extracted = extractAmountCents(formData, "amount", "50.00");
  if (!extracted.ok) return extracted.result;

  // The form always collects a positive magnitude plus a direction toggle
  // (mirrors TransactionForm's type+amount split) rather than asking the
  // user to type a "-" sign, which is easy to mistype or forget.
  const direction = formData.get("direction");
  const signedAmountCents = direction === "WITHDRAWAL" ? -extracted.amountCents : extracted.amountCents;

  try {
    await enforceMutationRateLimit("contributeToGoalAction");
    const updated = await contributeToGoal(id, {
      amountCents: signedAmountCents,
      date: formData.get("date"),
      note: formData.get("note") || undefined,
    });
    revalidatePath(GOALS_PATH);
    return { ok: true, data: updated };
  } catch (err) {
    return toErrorResult(err, "contributeToGoalAction");
  }
}
