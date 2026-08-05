// Display/input-parsing helpers only. The server layer (DAL, schemas,
// database) works exclusively in integer cents — nothing in this file is
// ever the source of truth for a stored amount, only the boundary where a
// human types a dollar string or reads a formatted one.

/**
 * "12.34" -> 1234, "12" -> 1200, ".50" -> 50. Rejects anything that isn't a
 * plain non-negative number with at most two decimal places (no leading
 * "-", no thousands separators, no scientific notation) — deliberately
 * strict, since this only ever feeds a Zod schema that will reject a bad
 * value anyway; failing early here just produces a friendlier field error.
 */
export function parseMoneyToCents(input: string): number {
  const trimmed = input.trim();
  if (!/^\d*\.?\d{0,2}$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    throw new Error(`Invalid amount: "${input}"`);
  }
  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const cents = (fractionPart + "00").slice(0, 2);
  return Number(wholePart || "0") * 100 + Number(cents);
}

/** 1234 -> "$12.34" */
export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
