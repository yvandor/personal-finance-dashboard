"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createRecurringBill,
  updateRecurringBill,
  archiveRecurringBill,
  unarchiveRecurringBill,
  markBillPaid,
  type RecurringBillDTO,
  type MarkBillPaidResult,
} from "@/server/data/recurringBills";
import { parseMoneyToCents } from "@/lib/money";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { reportUnexpectedActionError } from "@/server/logger";
import type { ActionResult } from "@/lib/result";

// Thin by design, mirroring server/actions/categories.ts: extract FormData
// -> call the DAL (which re-validates with the existing Zod schemas and
// re-derives the owner from the session) -> revalidate -> shape the result.
// No userId is ever read from `formData`.

const BILLS_PATH = "/bills";

function errorResult(message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error: message, fieldErrors };
}

function toErrorResult(err: unknown, actionName: string): ActionResult<never> {
  if (err instanceof z.ZodError) {
    const fieldErrors = err.flatten().fieldErrors as Record<string, string[]>;
    return errorResult("Please fix the highlighted fields.", fieldErrors);
  }
  if (err instanceof NotFoundError) {
    return errorResult("That bill couldn't be found.");
  }
  if (err instanceof ValidationError) {
    return errorResult(err.message);
  }
  reportUnexpectedActionError(actionName, err);
  return errorResult("Something went wrong. Please try again.");
}

function extractAmountCents(
  formData: FormData,
): { ok: true; amountCents: number } | { ok: false; result: ActionResult<never> } {
  const raw = formData.get("amount");
  try {
    return { ok: true, amountCents: parseMoneyToCents(typeof raw === "string" ? raw : "") };
  } catch {
    return {
      ok: false,
      result: errorResult("Please fix the highlighted fields.", { amount: ["Enter a valid amount, like 49.99."] }),
    };
  }
}

function extractDueDay(formData: FormData): { ok: true; dueDay: number } | { ok: false; result: ActionResult<never> } {
  const raw = formData.get("dueDay");
  const dueDay = typeof raw === "string" ? Number(raw) : NaN;
  if (typeof raw !== "string" || raw === "" || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    return {
      ok: false,
      result: errorResult("Please fix the highlighted fields.", { dueDay: ["Enter a day of the month, 1-31."] }),
    };
  }
  return { ok: true, dueDay };
}

function revalidateBillPaths(): void {
  revalidatePath(BILLS_PATH);
}

export async function createRecurringBillAction(
  _prevState: ActionResult<RecurringBillDTO> | null,
  formData: FormData,
): Promise<ActionResult<RecurringBillDTO>> {
  const amount = extractAmountCents(formData);
  if (!amount.ok) return amount.result;
  const due = extractDueDay(formData);
  if (!due.ok) return due.result;

  try {
    const created = await createRecurringBill({
      name: formData.get("name"),
      amountCents: amount.amountCents,
      dueDay: due.dueDay,
      categoryId: formData.get("categoryId") || null,
      notes: formData.get("notes") || undefined,
    });
    revalidateBillPaths();
    return { ok: true, data: created };
  } catch (err) {
    return toErrorResult(err, "createRecurringBillAction");
  }
}

export async function updateRecurringBillAction(
  id: string,
  _prevState: ActionResult<RecurringBillDTO> | null,
  formData: FormData,
): Promise<ActionResult<RecurringBillDTO>> {
  const amount = extractAmountCents(formData);
  if (!amount.ok) return amount.result;
  const due = extractDueDay(formData);
  if (!due.ok) return due.result;

  try {
    const updated = await updateRecurringBill(id, {
      name: formData.get("name"),
      amountCents: amount.amountCents,
      dueDay: due.dueDay,
      categoryId: formData.get("categoryId") || null,
      notes: formData.get("notes") || null,
    });
    revalidateBillPaths();
    return { ok: true, data: updated };
  } catch (err) {
    return toErrorResult(err, "updateRecurringBillAction");
  }
}

export async function archiveRecurringBillAction(
  id: string,
  // Required by useTransition's calling convention even though this action
  // doesn't need the previous result.
  prevState: ActionResult<void> | null,
): Promise<ActionResult<void>> {
  void prevState;
  try {
    await archiveRecurringBill(id);
    revalidateBillPaths();
    return { ok: true, data: undefined };
  } catch (err) {
    return toErrorResult(err, "archiveRecurringBillAction");
  }
}

export async function unarchiveRecurringBillAction(
  id: string,
  prevState: ActionResult<void> | null,
): Promise<ActionResult<void>> {
  void prevState;
  try {
    await unarchiveRecurringBill(id);
    revalidateBillPaths();
    return { ok: true, data: undefined };
  } catch (err) {
    return toErrorResult(err, "unarchiveRecurringBillAction");
  }
}

// Deliberately not optimistic on the client (see
// components/bills/MarkBillPaidForm.tsx's comment) -- this is a plain
// useActionState-bound action like every other write here, it's just that
// no caller dispatches a client-side guess of its result first.
export async function markBillPaidAction(
  id: string,
  _prevState: ActionResult<MarkBillPaidResult> | null,
  formData: FormData,
): Promise<ActionResult<MarkBillPaidResult>> {
  try {
    const result = await markBillPaid(id, {
      periodMonth: formData.get("periodMonth"),
      logTransaction: formData.get("logTransaction") === "true",
      date: formData.get("date") || undefined,
    });
    revalidateBillPaths();
    return { ok: true, data: result };
  } catch (err) {
    return toErrorResult(err, "markBillPaidAction");
  }
}
