// Pure, dependency-free -- same convention as lib/money.ts/lib/dates.ts --
// so the allowlist-parsing logic is unit-testable without touching
// server/auth.ts's NextAuth config or a real sign-in flow.

/**
 * This app has no self-serve sign-up story (see docs/PROJECT_PLAN.md §8):
 * only accounts whose email appears in ALLOWED_SIGNIN_EMAILS may complete
 * sign-in, checked from server/auth.ts's `signIn` callback. Comparison is
 * case-insensitive and whitespace-trimmed on both sides, since email
 * casing isn't meaningfully significant and a stray space in an env var is
 * an easy, otherwise-silent way to lock the intended owner out.
 *
 * An empty or unset allowlist rejects everyone -- fail closed, never open.
 * There is no "any email is fine" mode; that would defeat the point.
 */
export function isAllowedSigninEmail(email: string | null | undefined, allowedSigninEmails: string | undefined): boolean {
  if (!email) return false;
  const allowed = parseAllowlist(allowedSigninEmails);
  return allowed.has(email.trim().toLowerCase());
}

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}
