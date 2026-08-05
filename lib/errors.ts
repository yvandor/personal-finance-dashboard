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
