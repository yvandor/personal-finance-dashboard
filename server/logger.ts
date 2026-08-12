import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { NotFoundError } from "@/lib/errors";

// Structured, security-relevant event logging. One JSON object per line on
// stdout -- Vercel's Runtime Logs capture stdout verbatim and parse
// JSON-shaped lines into queryable fields, so there is deliberately no
// logging library, no transport, and no vendor SDK here: the dependency
// would buy nothing this file doesn't already get for free, and every
// dependency in the request path is more attack surface (see
// docs/PROJECT_PLAN.md §8's "minimal dependency surface").
//
// THE POINT OF THIS MODULE'S SHAPE: there is no exported `log(obj)`. Every
// event is a separate function whose parameter type spells out exactly which
// fields that event may carry, and `emit()` is module-private. A caller
// therefore cannot pass an amountCents, a transaction description, a raw
// Prisma error, a session token, or an email address into a log line by
// accident -- not because a reviewer would catch it, but because there is no
// parameter to put it in. docs/PROJECT_PLAN.md §8 ranks "information
// disclosure via errors/logs" as a live threat and states outright that
// "logs never include transaction amounts or descriptions"; this is that
// rule expressed as a type signature rather than as a convention.
//
// Emails are the one identifier worth logging and the one that is
// unambiguously PII, so they are only ever logged through hashEmail() --
// enough to correlate repeated blocked sign-in attempts from the same
// address without the log itself becoming a list of who uses this app.

/** Fixed key set per event, so a log line's shape is auditable from this type alone. */
type LogEvent =
  | { event: "auth.signin.blocked"; emailHash: string; provider: string }
  | { event: "auth.signin.success"; userId: string; provider: string }
  | { event: "authz.denied"; resource: AuthzResource; resourceId: string }
  | {
      event: "action.unexpected_error";
      actionName: string;
      errorName: string;
      correlationId: string;
      errorMessage?: string;
    };

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, event: LogEvent): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, ...event }));
}

/**
 * A stable, non-reversible handle for an email address: the first 12 hex
 * characters of SHA-256 over the lowercased, trimmed address.
 *
 * Truncated on purpose. 48 bits is far more than enough to tell "the same
 * address was blocked nine times in a minute" from "nine different
 * addresses were blocked once each," which is the only question a log line
 * needs to answer here -- while making the digest useless for confirming a
 * guessed address by comparison, which a full digest of a low-entropy value
 * like an email address would otherwise allow trivially.
 *
 * Lowercased and trimmed first so the same address logged from two
 * differently-cased sources correlates, matching how
 * lib/auth.ts's isAllowedSigninEmail() normalizes before comparing.
 */
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
}

/**
 * A sign-in attempt from an address that is not on ALLOWED_SIGNIN_EMAILS.
 * Warn, not error: a rejected sign-in is the allowlist working, not a fault
 * -- but it is the one event worth alerting on if it ever comes in bursts,
 * since this app has no self-serve sign-up and therefore no legitimate
 * reason for a stranger to be attempting one.
 */
export function logAuthSigninBlocked(fields: { emailHash: string; provider: string }): void {
  emit("warn", { event: "auth.signin.blocked", ...fields });
}

/**
 * A completed sign-in. userId is an opaque cuid with no personal
 * information encoded in it, so unlike the email it is logged as-is -- it
 * is what makes an authz.denied line later in the same session
 * attributable to an account without the log ever naming a person.
 */
export function logAuthSigninSuccess(fields: { userId: string; provider: string }): void {
  emit("info", { event: "auth.signin.success", ...fields });
}

/**
 * A `{ id, userId }`-scoped lookup came back empty. Deliberately coarse:
 * this fires identically whether the row genuinely does not exist or exists
 * under another owner, because the DAL never asks which -- see
 * lib/errors.ts and docs/PROJECT_PLAN.md §8's "not-found and not-owned
 * return the same 404 -- no existence oracle". Distinguishing the two in
 * the log would mean an extra existence query per miss AND would rebuild,
 * inside the log, exactly the existence oracle the 404 was designed to
 * deny. The signal that matters is the rate: an authenticated session
 * producing a burst of these is someone walking ids.
 *
 * No userId field: this event's value is the pattern, and the request's own
 * sign-in event already carries the account.
 */
export function logAuthzDenied(fields: { resource: AuthzResource; resourceId: string }): void {
  emit("warn", { event: "authz.denied", ...fields });
}

// Bound so a pathological message (a Prisma error's, say) can't push a
// multi-kilobyte blob into the log even outside production.
const MAX_ERROR_MESSAGE_CHARS = 300;

/**
 * An exception no Server Action expected -- i.e. not a ZodError, a
 * NotFoundError, or a ValidationError, all of which are ordinary
 * ActionResult return values in this codebase, not failures.
 *
 * errorMessage is dropped entirely in production and only kept outside it.
 * This is the specific "Prisma errors can include query fragments and
 * parameter values" risk from docs/PROJECT_PLAN.md §8's threat list: a
 * PrismaClientKnownRequestError's own `.message` can quote the failing
 * query and its bound parameters, which for this app means amounts,
 * descriptions and notes. Locally that detail is the whole point of the
 * log; in production the correlationId plus errorName is what an operator
 * actually acts on, and the message is not worth the leak. Never log the
 * error object itself -- JSON.stringify over a Prisma error walks into
 * `meta` and does exactly what this rule exists to prevent.
 */
export function logActionUnexpectedError(fields: {
  actionName: string;
  errorName: string;
  errorMessage: string;
  correlationId: string;
}): void {
  const { errorMessage, ...safe } = fields;
  emit("error", {
    event: "action.unexpected_error",
    ...safe,
    ...(process.env.NODE_ENV === "production"
      ? {}
      : { errorMessage: errorMessage.slice(0, MAX_ERROR_MESSAGE_CHARS) }),
  });
}

/**
 * The single funnel every Server Action's unexpected-error branch calls,
 * replacing the per-file `console.error("Unexpected error in a X action:",
 * err)` that used to log the raw error object. Takes `unknown` and reduces
 * it to two strings here rather than trusting each call site to do that
 * safely, since "just log the error" is precisely the reflex that leaks
 * Prisma parameter values.
 *
 * Returns the correlationId so a caller could surface it, though none does
 * today -- see server/actions/*.ts.
 */
export function reportUnexpectedActionError(actionName: string, err: unknown): string {
  const correlationId = randomUUID();
  logActionUnexpectedError({
    actionName,
    errorName: err instanceof Error ? err.name : typeof err,
    errorMessage: err instanceof Error ? err.message : "",
    correlationId,
  });
  return correlationId;
}

export type AuthzResource =
  | "transaction"
  | "category"
  | "budget"
  | "savingsGoal"
  | "incomeSource"
  | "recurringBill";

// Preserves each DAL's existing NotFoundError message verbatim, now derived
// from the resource rather than retyped at all 26 throw sites -- which is
// also what keeps the messages from drifting apart into an accidental
// oracle ("Budget not found" vs "Budget not found or not yours").
const NOT_FOUND_MESSAGES: Record<AuthzResource, string> = {
  transaction: "Transaction not found",
  category: "Category not found",
  budget: "Budget not found",
  savingsGoal: "Savings goal not found",
  incomeSource: "Income source not found",
  recurringBill: "Recurring bill not found",
};

/**
 * Builds the NotFoundError a DAL throws on a scoped-lookup miss, logging
 * the authz.denied event as it does. Returns the error rather than throwing
 * it so call sites keep an explicit `throw` -- control flow stays obvious
 * to a reader and to TypeScript's reachability analysis alike.
 *
 * Pairing the log with the error's construction is the mechanism, not a
 * convenience: it is why no future `{ id, userId }` miss can be added to
 * server/data/** that throws NotFoundError without also being logged.
 */
export function authzDenied(resource: AuthzResource, resourceId: string): NotFoundError {
  logAuthzDenied({ resource, resourceId });
  return new NotFoundError(NOT_FOUND_MESSAGES[resource]);
}
