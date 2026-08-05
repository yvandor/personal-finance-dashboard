# Personal Finance Dashboard

A Next.js 16 + PostgreSQL + Prisma personal finance dashboard. Manual/sample
data only — no bank connections, no stored banking credentials. See
`docs/PROJECT_PLAN.md` (repo root, one level up) for the full product and
architecture plan.

Currently implemented: the database schema and a server-side data-access
layer for transactions (`server/data/transactions.ts`). There is no UI yet
and no authentication yet.

## Getting started

Prerequisites: Node 24+, a local PostgreSQL instance (see `prisma/schema.prisma`
for the schema; any PostgreSQL 13+ works — the trigram search index requires
`pg_trgm`, which the migration installs automatically).

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` for your local
   Postgres. Also copy `.env.test.example` to `.env.test` pointing at a
   **separate** database — the test suite truncates tables freely and must
   never point at data you care about.
3. `npx prisma migrate deploy` — applies the schema to your database.
4. `npm run test` — runs the full test suite (see below; this needs the
   `.env.test` database from step 2).
5. `npm run dev` — starts the dev server (currently just the default Next.js
   landing page; there's no dashboard UI yet).

## The temporary development-user strategy

Authentication is not implemented yet (planned for a later phase, once the
core data model and CRUD logic are solid). Every table that belongs to a
user already has a `userId` column, and every function in `server/data/**`
resolves the acting user through a single function:

```ts
// server/context.ts
export const requireUserId = cache(async (): Promise<string> => { ... });
```

Until real auth exists, this resolves to a **fixed id from the `DEV_USER_ID`
environment variable** — every call in the app acts as that one seeded user.
It's wrapped in React's `cache()` so multiple calls within the same
request/render (e.g. a future page that loads several summaries at once)
resolve the user once and reuse it, rather than re-reading the environment
variable redundantly per call. `cache()` only dedupes within a single
request — it is not a global cache and does not leak between requests.

**Why this is safe to defer:** there is no `userId` parameter anywhere in
the data-access layer for a caller to supply or spoof — `requireUserId()` is
the *only* source of the acting user, and it takes no input. When real
authentication (Auth.js) is added, only the body of this one function
changes to read the actual session; no DAL function, Server Action, or page
that calls `requireUserId()` needs to change. The one condition that makes
this safe in the meantime: **this app is never deployed anywhere public
before real authentication lands** — the dev-user strategy assumes a single
trusted local user, and it currently has no way to distinguish a second one.

Tests that need to simulate a *second* user (cross-user isolation checks)
mock `server/context.ts` itself with `vi.mock(...)` and swap the resolved id
per test. They never gain the ability to pass a userId as a parameter —
that capability simply doesn't exist in the real code path, in tests or
otherwise.

## A known shortcut: the `updateTransaction` read-then-write race

`updateTransaction` (`server/data/transactions.ts`) needs to validate that a
transaction's category still matches its (possibly just-changed) type —
e.g. rejecting an update that would attach an income category to an expense
transaction. Because that check depends on the category's *current* type in
the database, the function does:

1. Read the existing transaction (to know its current type, if the update
   doesn't change it).
2. Validate the target category's ownership and type against that.
3. Write the update.

Steps 1–3 are not one atomic operation. If the category referenced in step 2
were somehow changed by a concurrent write between the read and the write,
the type-match check could pass against stale information. This is a narrow
theoretical race in a **data-integrity** check, not a security boundary —
the actual ownership enforcement (which row gets updated at all) is a
separate, atomic `updateMany({ where: { id, userId } })`, unaffected by this
race, since a mismatched owner still updates zero rows regardless of timing.

Given there's no concurrent multi-request access pattern yet (single dev
user, no UI), this is an accepted, documented shortcut rather than a fix —
worth revisiting if concurrent edits to the same transaction ever become a
realistic scenario.

## Testing

```
tests/
  unit/         Pure logic — Zod schema validation. No database.
  integration/  Real CRUD against a real Postgres database. No mocking of
                Prisma — the point of this layer is to catch bugs a mock
                would hide, including the cross-user isolation suite.
```

`vitest.config.mts` loads `.env.test` (a database separate from your `.env`
dev database) and configures the `react-server` module resolution condition
that `server-only`-guarded modules need outside of Next.js's own bundler.

Run everything: `npm run test`. Integration tests wipe and reseed a fixed
dev-user and a second test user before each test (`tests/setup.ts`) — they
never touch any other data, but they do assume `.env.test` points at a
database that's safe to truncate.

## Local checks vs. CI

Everything CI runs can also be run locally, in the same order:

| Check | Local command | Needs Postgres? |
|---|---|---|
| Install | `npm ci` | no |
| Generate Prisma client | `npx prisma generate` | no |
| Type check | `npx tsc --noEmit` | no |
| Lint | `npx eslint .` | no |
| Apply migrations | `npx prisma migrate deploy` | **yes** |
| Tests (unit + integration) | `npm run test` | **yes**, for the integration half |
| Production build | `npm run build` | no |

CI (`.github/workflows/ci.yml`) runs on every push and pull request, in
exactly this order, against a **Postgres service container** — a throwaway
database that exists only for the duration of that one workflow run, using
hardcoded, non-sensitive credentials that are meaningless outside that
container. This is different from local development, where migrations
additionally need a *shadow* database (a separate throwaway database
`prisma migrate dev` creates and drops to diff schema changes) requiring a
role with `CREATEDB` — see `prisma.config.ts`'s `shadowDatabaseUrl`. CI never
needs a shadow database because it only ever runs `prisma migrate deploy`
(apply already-written migrations), never `migrate dev` (author new ones by
diffing), so a single ordinary database role is sufficient there.

The one thing CI does **not** verify: a live smoke test of the DAL against
a long-lived database (what I run manually against `finance_dev` after
notable changes). That's a deliberate judgment call, not an oversight — the
integration suite already exercises the same code paths against a real
database on every run; the manual smoke test's only additional value is
confirming the *actual dev database* (with its accumulated local state) still
behaves, which isn't something a stateless CI container can meaningfully
check anyway.
