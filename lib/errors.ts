// Distinguishable error types for the data-access layer. Callers use
// `instanceof` to tell "doesn't exist / isn't yours" (NotFoundError — the two
// are deliberately indistinguishable to the caller, so a lookup can never be
// used to probe which ids exist) apart from "the input itself is invalid"
// (ValidationError, for checks Zod can't express alone, like a category's
// type not matching the transaction's type).

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Thrown by server/rateLimit.ts when a user's mutation rate exceeds the
// configured budget. A distinct type (not a ValidationError) because the
// input itself isn't invalid -- the caller is, at this moment, sending too
// many requests -- and Server Actions map it to its own client-facing
// message rather than "please fix the highlighted fields."
export class RateLimitError extends Error {
  constructor(message = "Too many changes in a short time. Please wait a moment and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}
