// Shared shape every Server Action returns. Consumed by useActionState on
// the client; never contains raw errors (stack traces, SQL, Prisma
// internals) — see server/actions/transactions.ts's error mapping.
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
