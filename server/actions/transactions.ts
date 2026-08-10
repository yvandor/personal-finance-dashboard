"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  type TransactionDTO,
} from "@/server/data/transactions";
import { parseMoneyToCents } from "@/lib/money";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type { ActionResult } from "@/lib/result";

// Thin by design: extract FormData -> call the DAL (which re-validates with
// the existing Zod schemas and re-derives the owner from the session) ->
// revalidate -> shape the result. No userId is ever read from `formData` —
// the DAL's requireUserId() is the only source, so there's nothing here for
// a forged "userId" field to do even if a request included one.

const TRANSACTIONS_PATH = "/transactions";

function errorResult(message: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error: message, fieldErrors };
}

// Maps a thrown error to a client-safe result. Only ever forwards messages
// from error types we throw ourselves for expected, input-shaped problems
// (NotFoundError, ValidationError, ZodError) -- never a raw caught error's
// message, which could be a Prisma/driver error naming columns or leaking
// internals.
function toErrorResult(err: unknown): ActionResult<never> {
  if (err instanceof z.ZodError) {
    const fieldErrors = err.flatten().fieldErrors as Record<string, string[]>;
    return errorResult("Please fix the highlighted fields.", fieldErrors);
  }
  if (err instanceof NotFoundError) {
    return errorResult("That transaction, category, or income source couldn't be found.");
  }
  if (err instanceof ValidationError) {
    return errorResult(err.message);
  }
  console.error("Unexpected error in a transaction action:", err);
  return errorResult("Something went wrong. Please try again.");
}

interface TransactionFieldInput {
  type: FormDataEntryValue | null;
  amountCents: number;
  date: FormDataEntryValue | null;
  description: FormDataEntryValue | null;
  notes: FormDataEntryValue | undefined;
  categoryId: FormDataEntryValue | null;
  // Always resent as an explicit cuid string or `null` -- never omitted --
  // so an update can clear an existing link, not just set a new one. See
  // lib/schemas/transaction.ts's comment on incomeSourceId.
  incomeSourceId: string | null;
}

type ExtractResult =
  | { ok: true; data: TransactionFieldInput }
  | { ok: false; result: ActionResult<never> };

// Extracted separately from Zod parsing so a bad amount string produces a
// field-specific error ("amount") rather than falling through to the DAL's
// generic Zod failure, which wouldn't know the string came from this field.
function extractTransactionFields(formData: FormData): ExtractResult {
  const amountRaw = formData.get("amount");
  let amountCents: number;
  try {
    amountCents = parseMoneyToCents(typeof amountRaw === "string" ? amountRaw : "");
  } catch {
    return {
      ok: false,
      result: errorResult("Please fix the highlighted fields.", {
        amount: ["Enter a valid amount, like 12.34."],
      }),
    };
  }

  const incomeSourceIdRaw = formData.get("incomeSourceId");
  const incomeSourceId = typeof incomeSourceIdRaw === "string" && incomeSourceIdRaw !== "" ? incomeSourceIdRaw : null;

  return {
    ok: true,
    data: {
      type: formData.get("type"),
      amountCents,
      date: formData.get("date"),
      description: formData.get("description"),
      notes: formData.get("notes") || undefined,
      categoryId: formData.get("categoryId"),
      incomeSourceId,
    },
  };
}

export async function createTransactionAction(
  _prevState: ActionResult<TransactionDTO> | null,
  formData: FormData,
): Promise<ActionResult<TransactionDTO>> {
  const extracted = extractTransactionFields(formData);
  if (!extracted.ok) return extracted.result;

  try {
    const created = await createTransaction(extracted.data);
    revalidatePath(TRANSACTIONS_PATH);
    return { ok: true, data: created };
  } catch (err) {
    return toErrorResult(err);
  }
}

export async function updateTransactionAction(
  id: string,
  _prevState: ActionResult<TransactionDTO> | null,
  formData: FormData,
): Promise<ActionResult<TransactionDTO>> {
  const extracted = extractTransactionFields(formData);
  if (!extracted.ok) return extracted.result;

  try {
    const updated = await updateTransaction(id, extracted.data);
    revalidatePath(TRANSACTIONS_PATH);
    return { ok: true, data: updated };
  } catch (err) {
    return toErrorResult(err);
  }
}

export async function deleteTransactionAction(
  id: string,
  // Required by useActionState's calling convention even though delete
  // doesn't need the previous result.
  prevState: ActionResult<void> | null,
): Promise<ActionResult<void>> {
  void prevState;
  try {
    await deleteTransaction(id);
    revalidatePath(TRANSACTIONS_PATH);
    return { ok: true, data: undefined };
  } catch (err) {
    return toErrorResult(err);
  }
}
