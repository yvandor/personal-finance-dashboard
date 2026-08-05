# Personal Finance Dashboard — Project Plan

**Status:** Planning complete, awaiting approval. No application code has been written.
**Scope of this document:** consolidated output of a seven-specialist planning pass (product, architecture, database, UI/UX, security, testing, documentation) over the current repository state.

**Repository facts this plan is built on:** `/web` is a freshly scaffolded Next.js **16.3.0** app (App Router, React 19.2.8, TypeScript strict, Tailwind CSS 4, ESLint flat config) with no `src/` folder — `app/`, and the `lib/`, `server/`, `components/`, `prisma/` folders proposed below all sit at the `/web` root, matching the existing `"@/*": ["./*"]` path alias. No database, ORM, auth, validation library, or charting library is installed yet, and no routes exist beyond the default template. Next 16 carries breaking changes from earlier Next versions (`middleware.ts` → `proxy.ts`, async `params`/`searchParams`/`cookies()`/`headers()`, Turbopack as the default bundler, `@theme` CSS-first Tailwind config) — this plan designs against those, not against older Next conventions.

---

## 1. Product Requirements

### Problem statement

**Who this is for:** an individual managing personal or single-household finances on their own — someone with a handful of recurring expense categories and one or two savings targets, financially motivated but not an accountant, currently tracking money in a spreadsheet, a notes app, or not at all.

**The pain:**
- Bank statements are transaction-level and category-free; by month's end the spending story is unreadable.
- DIY spreadsheets rot — formulas break, categories drift, mobile editing is miserable, and entry stops.
- Aggregators (Mint-style) require handing over bank credentials, which a meaningful share of privacy-conscious users will simply refuse.
- Feedback arrives too late — overspending is discovered at month-end, when nothing can be done about it.

**Our answer:** a fast, mobile-friendly dashboard where the user enters transactions manually, categorizes them, and immediately sees monthly cash flow, per-category budget burn, and savings-goal progress. **Manual entry is the product position, not a limitation** — no bank connection, no stored credentials, ever. The tradeoff we accept is that the user does data entry; the tradeoff we must win on is that entry is fast (sub-10-second add-transaction on a phone) and the resulting insight is immediate.

**Success looks like:** a user can log a week of spending in a few minutes and, on the dashboard, answer three questions without clicking into anything: *Am I up or down this month? Which category am I blowing? Am I on track for my goal?*

### Prioritized requirements

**P0 — must-have for MVP**

| # | Requirement | Notes |
|---|---|---|
| R1 | Transaction CRUD (income and expense) | Amount, date, type, category, description |
| R2 | Category system with seeded defaults | User-manageable; usable in 30 seconds with no setup |
| R3 | Monthly totals: income, expenses, net cash flow, savings | Computed server-side, integer cents |
| R4 | Monthly budgets per category with actual-vs-budget progress | One budget per (category, month) |
| R5 | Savings goals with progress tracking | Target amount, current amount, optional target date |
| R6 | Spending charts | Category breakdown for selected month + income/expense trend over recent months |
| R7 | Search and filter transactions | Text search on description; filter by date range, category, type, amount range |
| R8 | Responsive desktop + mobile | Mobile is a first-class entry surface |
| R9 | Money as integer cents end to end | No floats in storage, computation, or payloads |
| R10 | Server-side validation on every mutation | Client validation is UX only; server is the authority |
| R11 | `userId` on every user-owned row from day one | See auth sequencing note below — this is not deferred |
| R12 | Sample/seed data generator | Demo-ready dashboard; also the test fixture base |
| R13 | Secrets in env vars only | Nothing committed, nothing in the client bundle |

**P0-late — must-have, deliberately sequenced after the core UI**

| # | Requirement | Notes |
|---|---|---|
| R14 | Secure authentication (Auth.js) | Not first — see sequencing note |
| R15 | Per-user data isolation enforced server-side | Every query scoped by session user; client-supplied `userId` never trusted |

**Auth sequencing — the one call worth stating explicitly:** authentication is added later in development, but **the ownership model is not deferred**. Every user-owned table carries a `userId` column from the first migration, and every query goes through an owner-scoped data-access layer reading the owner from a single seam (`requireUserId()`). Pre-auth, that seam returns a fixed seeded user id. Turning on auth means changing what the seam returns plus adding route protection — not a schema migration and a rewrite of every query. **Retrofitting ownership onto an app that assumed a single user is the single most expensive mistake available on this project**, so the plan avoids it by construction. Corollary, treated as a hard gate: **the app is never deployed to a public URL before auth (R14/R15) lands and its isolation tests pass.**

**P1 — nice-to-have, post-MVP** (roughly ordered): budget rollover/carryover, recurring transactions, CSV export (then import), linking a goal contribution to a transaction, budget-threshold notifications, multi-currency, shared/household accounts, net-worth/account-balance tracking, dark mode, password reset/OAuth/2FA, custom date-range reports.

### Explicitly out of scope

| Out | Rationale |
|---|---|
| Bank connections / Plaid / any aggregator | Hard product constraint, never in scope |
| Storing banking credentials, account or card numbers | Hard constraint — no such field ever exists in the schema |
| Multi-currency | Contaminates every total/chart/budget with FX questions |
| Shared / household / multi-user accounts | Not trivial (invitations, roles, shared-budget conflicts); contradicts the simple per-user isolation model |
| Recurring transaction automation | Scheduling + idempotency + edit-series-vs-instance semantics; a P1 "duplicate" button gets most of the value for a fraction of the cost |
| CSV import (export is a cheap P1 candidate) | Import needs mapping, dedupe, malformed-row handling |
| Real-time collaboration | No second user exists in MVP |
| Account balances / net worth / reconciliation | A second core entity (accounts + opening balances) |
| Investment/crypto tracking, debt payoff planners, forecasting | Different product |
| Email notifications/digests, OAuth/2FA, receipt upload/OCR | No email dependency, no file storage subsystem in MVP |
| Tags, subcategories, split transactions | Flat, single-category-per-transaction only — the classic scope creepers |
| Native apps, offline mode, PWA install | Responsive web only |

**Scope-defense note:** the three requests most likely to arrive mid-build are *tags*, *split transactions*, and *recurring transactions*. Each looks small and each mutates the transaction model and every aggregate query. The data model deliberately does not pre-bend to accommodate them.

---

## 2. MVP Scope

**In:** transaction CRUD with undo-on-delete; categories with seeded defaults, income/expense typing, and a reassign-or-block delete rule; one budget per category per month with a "copy last month" action and an unbudgeted-but-spent view; savings goals with manual contributions (independent of the transaction ledger in MVP — stated plainly in the UI to avoid double-counting confusion), percent-complete and pace-to-target-date; a dashboard with a month switcher, summary tiles, category breakdown chart, 6-month trend chart, and recent transactions; search/filter with URL-persisted state and its own totals; email+password auth (argon2/bcrypt or OAuth — see Security §6) with server-side sessions, added after the core UI is functional; responsive layouts down to 375px; sample-data seeding; empty/loading/error states everywhere.

**Out:** everything in the "explicitly out of scope" table above.

---

## 3. User Stories

Format: **As a [user], I want to [action], so that [benefit].** AC = acceptance criteria, given where behavior is non-obvious.

### Transactions
- **Add an expense/income** — amount validated as a positive integer in cents server-side regardless of client bypass; date defaults to today; category picker restricted to the transaction's type; dashboard totals reflect the change without a manual refresh.
- **Fast mobile entry** — add-transaction reachable in one tap from the dashboard; amount field opens a numeric keypad (`inputMode="decimal"`); usable one-handed at 375px.
- **Edit a transaction** — AC: changing the date across a month boundary correctly moves the transaction out of the old month's totals/budget and into the new month's (the classic bug in this app category — flagged for the test plan).
- **Delete a transaction** — confirmation required; totals and budget progress update immediately; a short undo window is available.
- **Browse transactions** — reverse-chronological, paginated/infinite-scroll; mobile renders cards, not a squeezed table.
- **Empty state** — a new user's empty list offers an add-transaction CTA and a "load sample data" option.

### Categories
- **Seeded defaults** so a new account is usable with zero setup, typed income/expense.
- **Create / rename / recolor** — name unique per user (case-insensitive); renaming preserves all links, nothing orphaned.
- **Delete a category** — AC: unused categories delete outright; in-use categories require the user to reassign their transactions or cancel — a label deletion must never delete financial history.
- **Type-scoped pickers** so income can't be filed under an expense category.

### Budgets
- **Set a monthly budget per category** — one per (category, month); setting again updates rather than duplicates; only expense categories are budgetable.
- **See budget progress** — spent/budgeted/remaining/percent with under/near-limit(≥80%)/over(>100%) states; over-budget shows the overspend amount without breaking the progress-bar layout.
- **Budgets react to transaction changes** — AC: progress is *derived* at read time, never a stored running total that can drift; delete/edit/recategorize/cross-month-date-change all produce correct progress in every affected month.
- **Copy last month's budgets** — one click, with a warning before overwriting existing targets.
- **See unbudgeted spending** — categories with spend but no budget are called out separately.

### Savings Goals
- **Create a goal** — target > 0; optional target date must be future at creation.
- **Contribute to a goal** — increases current amount; contributions are independent of the transaction ledger in MVP (stated plainly in the UI).
- **See progress** — percent complete and remaining; progress bar caps visually at 100% even when overfunded (raw and clamped-display values are tracked separately).
- **Pace against a target date** — required-per-month = remaining ÷ months left; an overdue unmet goal shows an explicit overdue state, never a negative or infinite figure.
- **Edit / delete / complete a goal** — deleting a goal never touches transactions; completed goals move to a collapsed/archived section.

### Dashboard & Reporting
- **Monthly snapshot** — income, expenses, net cash flow, savings on one screen, signed and derived server-side in cents.
- **Switch months** — selection reflected in the URL, so a month view is linkable and survives refresh.
- **Spending-by-category chart** — colors match categories/budgets elsewhere; small categories group into "Other"; renders a real empty state for a zero-expense month.
- **Trend over time** — last ~6 months; months with no data render as zero, not a gap.
- **Drill-through** — clicking a chart segment or summary tile navigates to the transaction list pre-filtered to that month/category.
- **Try it with sample data** — clearly labeled, removable in one action.

### Search & Filter
- **Search by description** — case-insensitive substring match, server-side, debounced; the search term is always parameterized, never string-interpolated.
- **Filter by date range / category / type / amount range**, all combining with AND.
- **Totals for the filtered set** — answers "how much did I spend on dining last quarter."
- **Persistent, shareable filter state** — serialized to the URL; a one-click "clear all" is visible whenever a filter is active.
- **No-results state** distinguishes "nothing matches these filters" from "you have no transactions yet."

### Authentication & Data Isolation *(built later; still required before release)*
- **Sign up / log in / log out** — password (if used) hashed with argon2/bcrypt, never logged or stored reversibly; failed login gives a generic message that doesn't reveal whether the email exists; session is an httpOnly/secure/sameSite cookie, never a token in localStorage; login is rate-limited.
- **My data is only mine** — AC: every read/write is scoped by session user; requesting another user's record by id returns 404 (not 403 — existence is never confirmed); the owner is derived from the session only, never from a client-supplied `userId`; covered by an explicit isolation test suite across every resource type.
- **Protected routes** — unauthenticated visitors redirected to login; API routes/Server Actions return 401 independently of any middleware check; post-login lands on the originally requested page.
- **Session expiry** — defined lifetime; expiry redirects to login cleanly, no crash.

---

## 4. System Architecture

### The one pattern: Server Components for reads, Server Actions for writes

React Server Components read data directly through a server-only Data Access Layer (DAL); **all mutations are Server Actions; there is no REST API layer** between the UI and the database. This app has exactly one consumer (its own UI) — an HTTP API here would cost a serialization boundary and a second validation site for no benefit. Server Components let a page `await getMonthlySummary()` and render with no client fetch/loading waterfall; Server Actions give progressive enhancement, a single round trip returning both the mutation result and re-rendered UI, and integrate with `useActionState`/`useOptimistic`.

Route Handlers (`app/api/**/route.ts`) are permitted for exactly three jobs: `GET /api/health` (liveness), `GET /api/transactions/export` (CSV needs real HTTP headers), and `app/api/auth/[...nextauth]/route.ts` (Auth.js requires it). Anything else under `/api` is a design smell — it should be a Server Action.

### Four layers, one direction of dependency

```
app/**              RSC pages + layouts. Render only. Never imports Prisma.
   │  imports
   ▼
server/actions/**   'use server' — thin. Parse FormData → Zod → call DAL → refresh() → return ActionResult.
   │
   ▼
server/data/**      'server-only' DAL. THE ONLY place `prisma` is touched.
   │                Every function opens with `const userId = await requireUserId()`.
   ▼
server/db.ts        PrismaClient singleton.
```

`lib/**` is dependency-free in the other direction: pure functions (money math, date bucketing) and Zod schemas, importable from both server and client because they have zero Node dependencies.

**The enforced rule:** only `server/data/**` may import `@/server/db` — an ESLint `no-restricted-imports` rule makes this a build error, not a convention. This single rule is what makes per-user isolation auditable: "show me every query in the app" becomes `ls server/data/`.

### Where Zod lives

`lib/schemas/*.ts` — importable from both client and server, but **the Server Action is the only enforcement point that counts**. The client may reuse the same schema for instant inline feedback; that's UX, not a security control. Every action re-parses from scratch, and money strings are transformed to validated integer cents *inside* the schema so an untrusted string never reaches application code as anything but a validated `number`:

```ts
// lib/schemas/transaction.ts
export const transactionInputSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amountCents: z.string().transform(parseMoneyToCents)
    .pipe(z.number().int().positive().max(2_147_483_647)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.string().cuid(),
  description: z.string().trim().min(1).max(200),
}).strict(); // rejects userId, id, createdAt outright — the mass-assignment guard
```

### Money as integers, end to end

| Stage | Representation |
|---|---|
| Postgres | `amount_cents INTEGER` |
| Prisma | `amountCents Int` |
| DAL / Server Action / RSC → client props | `number` (integer), plain and serializable |
| Recharts datum | `number` (cents) — axes use a `tickFormatter` |
| **Render only** | `formatCents(cents)` → `"$1,234.56"` |

`Int` (not `BigInt`) caps a single row at ~$21.47M, comfortable for personal finance, and avoids `BigInt`'s JSON-serialization friction on every component. Aggregation (`SUM`) happens in Postgres, not JS. `lib/money.ts` is the *only* place arithmetic/parsing/formatting happens (`parseMoneyToCents`, `formatCents`, `sumCents`, `percentOf`); no `parseFloat`/`toFixed` anywhere else, enforced by a Vitest unit suite and code review.

### How Auth.js slots in later without a rewrite

Every user-owned row carries `userId` from the first migration, and a `User` table exists from day one. The entire "add auth" seam is one function:

```ts
// server/context.ts
export const requireUserId = cache(async (): Promise<string> => {
  // MVP: the seeded single user
  const id = process.env.DEV_USER_ID;
  if (!id) throw new Error('DEV_USER_ID is not set');
  return id;
});

// After Auth.js lands, only this body changes:
export const requireUserId = cache(async (): Promise<string> => {
  const session = await auth();
  if (!session?.user?.id) unauthorized();
  return session.user.id;
});
```

No DAL function, action, or component changes, because no caller ever passes a `userId` — it is *pulled* from ambient request context, never *pushed* by a caller, which structurally forecloses IDOR (an attacker cannot forge a parameter that doesn't exist in any signature). The rest of the auth landing is additive-only: `app/api/auth/[...nextauth]/route.ts`, `web/proxy.ts` (Next 16's renamed `middleware.ts` — cookie-presence redirect only, explicitly *not* the security boundary), an `(auth)` route group, and an additive Prisma migration adding Auth.js's `Account`/`Session`/`VerificationToken` models. The real authorization boundary is and remains `requireUserId()` inside the DAL, exercised on every query and unbypassable by a direct call to a Server Action (Server Actions are public HTTP endpoints — a page-level check does not protect the actions defined on that page).

### Request flow

**Read** (`/transactions?month=2026-07&q=coffee`): `proxy.ts` optimistically redirects if no session cookie (no DB call) → dashboard layout streams immediately without awaiting the DAL → the transactions page awaits `searchParams`, validates them through a filter schema (a URL is user input too), and calls `listTransactions(filter)` → the DAL calls `requireUserId()` then queries with `userId` unconditionally in the `where` → rows map to an explicit DTO (not the raw Prisma record, so a future column never silently ships to the browser) → the RSC renders server-side; a client Recharts leaf receives a plain `{month, incomeCents, expenseCents}[]` array; slow panels sit behind `<Suspense>` so the table isn't held hostage by aggregate queries.

**Write** (editing a transaction): a client form wired to `useActionState` posts `FormData` (no hand-written `fetch`) → the Server Action parses with Zod, returning `{ ok: false, fieldErrors }` on failure rather than throwing (validation failure is expected, not exceptional) → on success it calls the DAL, which runs `prisma.transaction.updateMany({ where: { id, userId }, data })` — `userId` in the `where` of a write *is* the ownership check, atomically, with no separate check-then-write race → the action calls `refresh()` and returns `{ ok: true }`; one round trip carries back both the result and the re-rendered RSC payload.

### Non-functional concerns

- **Error handling, three tiers:** expected errors (validation, business-rule conflicts) are return values (`ActionResult<T>`), never throws, and render inline next to the offending field; unexpected errors (dropped connection, unanticipated constraint) throw and are caught by segment-scoped `error.tsx` boundaries, with server error details never forwarded to the client; auth errors get framework treatment via `unauthorized()` once Auth.js lands.
- **Loading/optimistic UI:** `loading.tsx` per route segment for free streaming; `<Suspense>` around chart/summary panels; `useActionState`'s `pending` flag disables submit buttons; `useOptimistic` for add/edit/delete so a row appears immediately and auto-reverts on failure; `refresh()` after every mutation for read-your-writes semantics.
- **Maintainability as auth/multi-user land:** the thesis is *build the multi-user shape now, defer only the identity source* — `userId` exists from migration one (no backfill migration ever), one function is the auth seam, `userId` is never a parameter so it can't be spoofed, one ESLint-enforced directory (`server/data/**`) is the entire query surface to audit, and an isolation test suite (seeded two users, asserting cross-user reads/writes fail) is written *during* the MVP while there's only one user, so it's already the regression net the day a second user exists.

---

## 5. Proposed Folder Structure

```
web/
├── app/                                  # Routes ONLY. No business logic. Never imports prisma.
│   ├── layout.tsx                        # exists — root shell
│   ├── globals.css                       # exists — Tailwind v4 @theme tokens live HERE (no tailwind.config)
│   ├── error.tsx                         # top-level uncaught-exception boundary
│   ├── not-found.tsx
│   ├── unauthorized.tsx                  # added with auth
│   │
│   ├── (dashboard)/                      # route group — shared chrome, no URL segment
│   │   ├── layout.tsx                    # sidebar/bottom-nav + month switcher; streams, doesn't await DAL
│   │   ├── page.tsx                      # "/" overview: totals, cash-flow chart, budget bars
│   │   ├── loading.tsx
│   │   ├── transactions/
│   │   │   ├── page.tsx                  # list + search/filter (reads await searchParams)
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── budgets/page.tsx
│   │   ├── goals/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── categories/page.tsx
│   │
│   ├── (auth)/                           # empty until Auth.js lands; reserved
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   │
│   └── api/                              # deliberately near-empty
│       ├── health/route.ts
│       ├── transactions/export/route.ts  # CSV — needs real HTTP headers
│       └── auth/[...nextauth]/route.ts   # added with Auth.js
│
├── server/                               # 'server-only'. The trust boundary.
│   ├── db.ts                             # PrismaClient singleton w/ globalThis HMR guard
│   ├── context.ts                        # requireUserId() — THE auth seam
│   ├── auth.ts                           # Auth.js config; added later
│   ├── data/                             # ═ DAL: the only place `prisma` is referenced ═
│   │   ├── transactions.ts
│   │   ├── categories.ts
│   │   ├── budgets.ts
│   │   ├── goals.ts                      # savings goals + contributions + progress
│   │   └── summary.ts                    # monthly income/expense/savings/cash-flow aggregates
│   └── actions/                          # 'use server'. Thin: parse → DAL → refresh → ActionResult
│       ├── transactions.ts
│       ├── categories.ts
│       ├── budgets.ts
│       └── goals.ts
│
├── lib/                                  # Pure, dependency-free. Importable from server AND client.
│   ├── money.ts                          # parseMoneyToCents / formatCents / sumCents / percentOf
│   ├── dates.ts                          # month keys, ranges, UTC-safe boundaries
│   ├── result.ts                         # ActionResult<T>
│   └── schemas/                          # Zod — shared, but the SERVER is the enforcement point
│       ├── transaction.ts / category.ts / budget.ts / goal.ts / filters.ts
│
├── components/
│   ├── ui/                               # Button, Input, Dialog, Select, Table, Skeleton, Toast
│   ├── charts/                           # ALL 'use client' — Recharts is client-only
│   │   ├── cash-flow-chart.tsx / spending-by-category-chart.tsx / trend-chart.tsx / chart-theme.ts
│   ├── transactions/ budgets/ goals/ categories/  # feature widgets (forms, rows, cards)
│   └── money.tsx                         # <Money cents={n} /> — server component, single format site
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                           # one user + realistic sample categories/transactions
│
├── tests/
│   ├── unit/                             # colocated where noted, else here: money, dates, schemas, aggregates
│   ├── integration/                      # Vitest against a real test Postgres — isolation suite lives here
│   ├── e2e/                              # Playwright: CRUD flows, filtering, responsive
│   └── setup.ts
│
├── proxy.ts                              # added with auth — Next 16 rename of middleware.ts, Node runtime
├── vitest.config.mts
├── playwright.config.ts
├── .env.example                          # variable NAMES only, never values
├── next.config.ts / eslint.config.mjs / tsconfig.json / package.json   # exist
```

**Why each folder:** `app/` is routing/rendering only — if a page grows business logic, that logic belongs in `server/data/`. `server/` is the trust boundary, kept top-level so it's visually distinct from `app/`; every file starts with `import 'server-only'`, turning an accidental client import into a build error. `lib/` is the client-safe half, shared so `<TransactionRow>` and the DAL use the same `formatCents`, and one `transactionInputSchema` powers both server enforcement and client inline hints so they can't drift apart. `components/charts/` is quarantined because every Recharts component needs `'use client'`, making the client-bundle boundary a directory you can point at. `tests/` is split three ways because Vitest cannot exercise async Server Components — unit tests cover pure logic, integration tests hit a real Postgres DAL, Playwright covers anything involving an async RSC.

**Next 16-specific notes baked into this structure:** no `tailwind.config.ts` (Tailwind v4 is CSS-first, tokens live in `@theme` inside `globals.css`); no `webpack` key in `next.config.ts` (Turbopack is the default bundler and a webpack config key fails the build — use `serverExternalPackages: ['@prisma/client']` if bundling trouble appears); `proxy.ts` not `middleware.ts`; every page reading `searchParams`/`params` does so via `await`.

---

## 6. Database Schema Proposal

Nine models: four Auth.js adapter tables (defined now, wired up when auth lands) plus `Category`, `Transaction`, `Budget`, `SavingsGoal`, and `SavingsContribution`.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum TransactionType {
  INCOME
  EXPENSE
}

enum CategoryType {
  INCOME
  EXPENSE
}

enum GoalStatus {
  ACTIVE
  ACHIEVED
  ARCHIVED
}

// --- Auth.js adapter models (defined now; not wired up until auth lands) ---

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  currency      String    @default("USD") @db.Char(3) // display/formatting only, no FX in MVP
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  categories    Category[]
  transactions  Transaction[]
  budgets       Budget[]
  savingsGoals  SavingsGoal[]
  contributions SavingsContribution[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// --- Finance domain ---

model Category {
  id     String       @id @default(cuid())
  userId String
  name   String       @db.VarChar(60)
  type   CategoryType

  color      String  @default("#64748b") @db.VarChar(7) // hex, validated server-side
  icon       String? @db.VarChar(40)
  isArchived Boolean @default(false)                     // soft delete — history must not vanish
  isSystem   Boolean @default(false)                      // seeded rows; idempotent re-seeding

  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]
  budgets      Budget[]

  @@unique([userId, type, name])
  @@unique([id, userId]) // target of the composite same-owner FK below
  @@index([userId, isArchived, sortOrder])
  @@map("categories")
}

model Transaction {
  id     String @id @default(cuid())
  userId String

  amountCents Int              // always positive; direction lives in `type`
  type        TransactionType
  date        DateTime @db.Date // calendar date, not an instant — avoids timezone month-drift

  description String  @db.VarChar(200)
  notes       String? @db.VarChar(1000)
  categoryId  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  @@index([userId, date(sort: Desc), id]) // primary list + keyset pagination
  @@index([userId, categoryId, date])     // category filter + per-category rollups
  @@index([userId, type, date])           // income/expense split for summary
  @@index([userId, amountCents])          // amount-range filter
  @@map("transactions")
}

model Budget {
  id          String   @id @default(cuid())
  userId      String
  categoryId  String
  periodStart DateTime @db.Date // always the first of the budgeted month
  amountCents Int
  notes       String?  @db.VarChar(500)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([userId, categoryId, periodStart])
  @@index([userId, periodStart])
  @@map("budgets")
}

model SavingsGoal {
  id            String     @id @default(cuid())
  userId        String
  name          String     @db.VarChar(80)
  description   String?    @db.VarChar(500)
  targetCents   Int
  startingCents Int        @default(0) // progress = startingCents + SUM(contributions)
  targetDate    DateTime?  @db.Date
  status        GoalStatus @default(ACTIVE)
  color         String     @default("#0ea5e9") @db.VarChar(7)
  achievedAt    DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  user          User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  contributions SavingsContribution[]

  @@unique([userId, name])
  @@index([userId, status, targetDate])
  @@map("savings_goals")
}

model SavingsContribution {
  id          String   @id @default(cuid())
  userId      String
  goalId      String
  amountCents Int      // may be negative — a withdrawal
  date        DateTime @db.Date
  note        String?  @db.VarChar(200)
  createdAt   DateTime @default(now())

  user User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  goal SavingsGoal @relation(fields: [goalId], references: [id], onDelete: Cascade)

  @@index([goalId, date])
  @@index([userId, date])
  @@map("savings_contributions")
}
```

Progress is derived from a `SavingsContribution` ledger rather than a mutable `currentCents` column: it gives contribution history for free, enables a progress-over-time chart, and removes the drift risk of a denormalized total that a failed write could desynchronize. The same principle applies to budgets — spend is always computed from `Transaction` rows at read time, never stored, so it cannot go stale.

### Constraints Prisma can't express (added as raw SQL in the migration)

Prisma has no DSL for `CHECK` constraints or composite foreign keys onto non-primary keys — these are hand-added to the generated migration and are as load-bearing as the schema itself:

```sql
ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount_cents > 0);
ALTER TABLE budgets ADD CONSTRAINT budgets_amount_nonneg CHECK (amount_cents >= 0);
ALTER TABLE savings_goals
  ADD CONSTRAINT goals_target_positive CHECK (target_cents > 0),
  ADD CONSTRAINT goals_starting_nonneg CHECK (starting_cents >= 0);
ALTER TABLE transactions ADD CONSTRAINT transactions_description_nonempty
  CHECK (length(btrim(description)) > 0);
ALTER TABLE budgets ADD CONSTRAINT budgets_period_is_month_start
  CHECK (period_start = date_trunc('month', period_start)::date);

-- DB-level backstop for tenant isolation: even a query-layer bug that forgets
-- to scope a category lookup cannot write a cross-user link.
ALTER TABLE transactions ADD CONSTRAINT transactions_category_same_owner
  FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id) ON DELETE SET NULL;
ALTER TABLE budgets ADD CONSTRAINT budgets_category_same_owner
  FOREIGN KEY (category_id, user_id) REFERENCES categories (id, user_id) ON DELETE CASCADE;

-- Substring search on description ("star" -> "Starbucks") needs a trigram
-- index; Postgres full-text search is lexeme-based and would miss this.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX transactions_description_trgm_idx ON transactions USING GIN (description gin_trgm_ops);
```

**Default seed categories** (per user, `isSystem = true`): Income — Salary, Freelance, Investments, Gifts, Other Income. Expense — Housing, Groceries, Transport, Utilities, Dining Out, Health, Entertainment, Shopping, Subscriptions, Education, Travel, Other. Seeded per-user (never a shared global table) so "row without an owner" is never a representable state.

### Money representation

All monetary values are `Int` columns holding whole cents (`amountCents = 1250` → $12.50). **Not `Float`/`Double`** — IEEE-754 binary floats cannot represent 0.10 or 0.20 exactly, and summing transactions accumulates visible, trust-destroying error. **Not `Decimal`** — Postgres `NUMERIC` is exact but Prisma maps it to `Prisma.Decimal`, requiring explicit serialization everywhere it crosses the API boundary; integer cents give exactness *and* a primitive that serializes and arithmetics natively. **`Int` not `BigInt`** — 32-bit signed tops out at ~$21.47M per row, far beyond any realistic personal transaction, and avoids `BigInt`'s JSON-serialization friction; aggregate `SUM`s are still safe since Postgres returns `bigint` for a `SUM(int)` and totals stay far under `Number.MAX_SAFE_INTEGER`.

**Rounding:** addition/subtraction (monthly totals, cash flow, budget-vs-actual) are always exact integer math with no rounding. Rounding only applies to display-only percentages (`Math.round((spentCents / budgetCents) * 100)`) and averages — never to stored amounts, and a percentage is never stored, only computed. Month boundaries use half-open ranges `[first-of-month, first-of-next-month)` against a `DATE` column (not a timestamp), so a transaction's month is unambiguous regardless of server timezone.

### Indexing / query strategy

The realistic scale is tens of thousands of rows per user (a few thousand transactions/year), not millions — this rules out over-engineering. `@@index([userId, date(sort: Desc), id])` is the workhorse: `userId` leads because every query filters on it, descending `date` matches the default sort so the index supplies ordering for free, and `id` gives a stable tiebreaker enabling **keyset pagination** (`WHERE (date, id) < (cursor) ORDER BY date DESC, id DESC LIMIT 50`) instead of `OFFSET`, which stays constant-time as history grows. Category and type filters get their own composite indexes (`[userId, categoryId, date]`, `[userId, type, date]`) since they're the highest-selectivity UI filters and are almost always paired with a date range. Description search uses a `pg_trgm` GIN index rather than Postgres full-text search, because full-text is lexeme-based and would miss partial-word matches on proper nouns like merchant names (note: trigram indexes can't accelerate queries under 3 characters — the UI should debounce and avoid firing below that length).

Monthly aggregates are **computed on read, never stored** — a stored total is a cache requiring invalidation on every insert/update/delete/recategorize (four code paths to get wrong), the underlying query is a single indexed range scan over at most a few hundred rows, and a drifted stored aggregate is exactly the silent correctness bug a finance app cannot afford. If aggregates ever get slow (not expected at this scale), the escalation path is a materialized view, then a trigger-maintained summary table — neither belongs in the MVP.

### Per-user isolation, at the data layer

Three layers, because any single layer is one bug away from a cross-tenant leak — the most severe failure mode this app has: **(1) schema** — every user-owned table has a non-nullable `userId` FK with `onDelete: Cascade`, and there is no nullable-`userId`-means-shared convention anywhere; **(2) composite FKs** — `transactions_category_same_owner`/`budgets_category_same_owner` reference `categories (id, user_id)`, so even a service-layer bug that scopes the row lookup correctly but the *joined* category lookup by raw id would otherwise let user A attach user B's category — Postgres rejects that write outright; **(3) query layer** — see Architecture §4 and Security §7, no route/action ever calls `prisma.*` directly, mutations use `updateMany`/`deleteMany` with `{ id, userId }` in `where` so ownership is part of the query rather than a separate racy check, and `userId` originates only from the session, never from a request body/query/header.

---

## 7. Page and Component Map

### Routes

| Route | Purpose |
|---|---|
| `/` | Redirects to `/dashboard` (authed) or `/login` (not) |
| `/login`, `/signup` | Auth, centered card layout, no nav |
| `/dashboard` | Monthly overview: totals, cash-flow trend, spending breakdown, recent activity |
| `/transactions` | Full ledger — search, filter, sort, pagination, add/edit/delete |
| `/budgets` | Per-category monthly targets and budget-vs-actual |
| `/goals`, `/goals/[id]` | Savings goals, progress, and contribution history |
| `/categories` | Category CRUD |
| `/settings` | Profile, sign out (thin, post-MVP-friendly) |

Route groups: `(auth)` for login/signup, `(dashboard)` for everything else, sharing an `AppShell`.

### Per-page composition (key components)

- **`/dashboard`** — `MonthSwitcher`, `SummaryCards` (income/expenses/net savings/savings rate, each with a delta-vs-last-month indicator), `CashFlowChart` (Recharts composed bar+line, trailing 6 months), `CategoryBreakdownChart` (donut + text legend — see accessibility note below), `BudgetProgressSummary`, `GoalProgressSummary`, `RecentTransactionsList`.
- **`/transactions`** — `TransactionFilters` (debounced search, category multi-select, date range, type toggle, amount range, removable filter chips), `TransactionTable` (desktop) / `TransactionCardList` (mobile) fed by one shared data hook, `TransactionForm` (shared add/edit sheet), pagination, two distinct empty states (no data vs. no results).
- **`/budgets`** — `BudgetSummaryHeader` (total budgeted/spent/remaining), `BudgetList` → `BudgetRow` with an inline-editable `MoneyInput` and a color-banded `ProgressBar` (green/amber/red), `AddBudgetButton`, `CopyLastMonthButton`.
- **`/goals`** — `GoalGrid` → `GoalCard` with `GoalProgressRing`, pace hint (on-track/behind/reached), `ContributionForm`, `ContributionHistoryList`.
- **`/categories`** — `CategoryList` → `CategoryRow`, `CategoryForm`, `ConfirmDeleteDialog` with a reassignment step when the category is in use.

### Shared components

`AppShell` / `SidebarNav` (desktop) / `BottomNav` (mobile), `MonthSwitcher`, `TransactionForm`, `CategoryBadge`, `MoneyInput` (currency-masked, numeric keypad, right-aligned), `MoneyText`/`<Money cents={n}/>` (single formatting site, `tabular-nums`), `DateRangePicker`, `ProgressBar`/`GoalProgressRing`, `EmptyState`, `ConfirmDeleteDialog`, a responsive `FormSheet` (modal on desktop, bottom sheet on mobile), `Toast`/`ToastProvider`, skeleton loaders, `ChartTooltip`/`ChartLegend`/`ChartContainer`.

### Responsive design

Mobile-first; the meaningful breakpoints are `lg` (1024px, shell layout) and `md` (768px, table/card density). Below `lg`, the sidebar is replaced by a sticky top bar plus a `BottomNav` with a center "add transaction" FAB (respecting `env(safe-area-inset-bottom)`). `TransactionTable` and `TransactionCardList` render from one hook rather than CSS-hiding duplicate trees, so only one is ever mounted. Charts always wrap in Recharts `ResponsiveContainer` with a fixed pixel height per breakpoint (percentage heights collapse in flex/grid parents) and reduce data density on mobile (fewer trailing months, abbreviated axis labels). Minimum 44×44px tap targets; `inputMode="decimal"` and 16px base font on money inputs (prevents iOS zoom-on-focus).

### Key interaction flows

- **Add a transaction:** sheet opens focused on amount → inline validation on blur/submit (never a disabled submit button — clicking surfaces and focuses the first error) → optimistic insert with the sheet closing immediately → success toast with a 5-second **Undo**; failure rolls the optimistic row back and reopens the sheet with input preserved.
- **Edit a budget:** the limit is inline-editable directly in the row; typing live-previews the progress bar and remaining figure before committing; commit on blur/Enter, revert on Escape; a quiet inline "Saved" checkmark rather than a toast (toasts on every keystroke-scale edit are noise).
- **Track a savings goal:** contribution sheet with quick-add amount chips; the progress ring animates old→new percentage (respecting `prefers-reduced-motion`); crossing 100% swaps the card into a completed state rather than an overflowing bar.

### Accessibility

Every form control gets a real `<label htmlFor>` (never a placeholder-as-label); errors live in an `aria-describedby` region with `aria-invalid` on the input. Chart meaning is never color-only — budget status carries an icon/text label alongside the color band, income/expense uses a `+`/`−` prefix, and every chart is paired with a text legend carrying the same numbers so the data is reachable without perceiving the graphic (the donut caps at ~7 categories + "Other" for distinguishability). Modals/sheets trap focus, return it to the trigger on close, and close on Escape (`role="dialog"`, `aria-modal="true"`); `ConfirmDeleteDialog` focuses Cancel by default, never the destructive action. The app is fully keyboard-operable — row actions are real `<button>`s in tab order, not hover-only; visible focus rings everywhere.

---

## 8. Security Plan

**Product constraint that shapes everything:** no bank linkage, no banking credentials, no aggregator integration — ever. This removes the highest-severity asset class (third-party financial credentials) from the threat model entirely. **The remaining crown jewel is one user's financial history being readable by another user.**

### Threat model summary (ranked by realistic likelihood × impact)

1. **Broken object-level authorization / IDOR (critical, most likely)** — the dominant risk given the app is CRUD over per-user objects. Classic failure: `prisma.transaction.update({ where: { id: input.id }, data })` — correct-looking, ownership-blind. Also applies to aggregate/report endpoints and to *create* (cross-linking a foreign `categoryId` into your own data).
2. **Mass assignment on update (high)** — spreading a request body into a Prisma `data:` object lets a client set `userId`, `id`, or future sensitive fields. Zod's `.strip()` only helps if the input schema is an explicit allow-list, never a 1:1 mirror of the Prisma model.
3. **Session weaknesses once Auth.js lands (high)** — fixation, non-`httpOnly` cookies, missing `__Secure-`/`__Host-` prefixes, no revocation path.
4. **Pre-auth exposure window (high, a *plan* risk, not a code risk)** — the MVP ships with no authentication; if deployed publicly, all data is world-readable/writable. Addressed explicitly below.
5. **CSRF on mutating routes (medium-high)** — Server Actions get a built-in Origin/Host check; hand-rolled Route Handlers do not. Mixing the two styles inconsistently is where this bites.
6. **XSS via user-entered text (medium)** — React auto-escapes by default; the real vectors are narrow: chart tooltip/label formatters that accept raw HTML, `dangerouslySetInnerHTML`, user-controlled `href` (`javascript:` URLs), and **CSV formula injection** on export (`=HYPERLINK(...)` executing in Excel/Sheets).
7. **Injection via search/filter inputs (medium)** — Prisma parameterizes by default; the live risks are a future raw-SQL escape hatch, and **Prisma filter-object injection** (a client passing `{"userId":{"not":null}}` straight into `where` if filters aren't coerced to primitives first).
8. **Secret leakage (medium, high blast radius)** — a committed `DATABASE_URL`/`AUTH_SECRET`, or one accidentally prefixed `NEXT_PUBLIC_` and inlined into the client bundle.
9. **Information disclosure via errors/logs (low-medium)** — Prisma errors can include query fragments and parameter values.

**Explicitly out of scope by product constraint:** bank credential storage, financial-institution OAuth token vaults, PCI card data, payment initiation. Any future proposal along these lines is a new threat model, not an increment to this one.

### Authentication & session strategy

**Interim MVP (before Auth.js) — stated plainly:** the pre-auth build has no authentication and no authorization; anyone who can reach the URL can read and modify all data, and **it must never be deployed to a public host or bound to a non-loopback interface.** This is made cheap and safe by: modeling `userId` on every table from commit one; a single `requireUserId()` choke point everywhere in the codebase (§4); a boot-time guard that refuses to start in production without auth configured; local-only dev with sample data only (never a real personal budget) so the pre-auth window has nothing sensitive to lose.

**When Auth.js lands:** recommend **OAuth (GitHub/Google) as primary**, avoiding a Credentials provider — this removes password storage, reset flows, and hashing-parameter debates entirely for a single-operator app. Recommend **database sessions** via `@auth/prisma-adapter` over the JWT default: instant server-side revocation (delete the row, the session is dead — impossible with JWTs without a denylist), session rotation on sign-in as free fixation mitigation, and the DB is already in the request path so the added round trip is cheap. Cookie flags are non-negotiable: `httpOnly`, `secure` in production, `sameSite: 'lax'`, `__Secure-`/`__Host-` prefix, 7-day rolling `maxAge`. **Middleware/`proxy.ts` is for redirect UX only, never the authorization boundary** — every Server Action and Route Handler independently re-derives the session (this is a durable lesson independent of any specific CVE, given Next middleware has had bypass vulnerabilities historically).

### Authorization — per-user isolation (the single most important section)

Three layers, defense in depth: **(1)** the only user id in the app originates from `requireUserId()`, marked `import 'server-only'` so it can't be pulled into a client bundle — a `userId` must never appear in any Zod input schema, request body, query string, or hidden field; **(2)** every query is scoped structurally — reads use `findFirst({ where: { id, userId } })` (never `findUnique` by id alone followed by a check), writes use `updateMany`/`deleteMany` with `{ id, userId }` in `where` so ownership is part of the query itself with no check-then-write race, and any client-supplied foreign key (`categoryId`) is ownership-validated before use, ideally via the compound-unique `connect`; **(3)** a repository boundary — no route/action/RSC calls `prisma.*` directly, all access goes through `server/data/**` where every exported function takes `userId` as its first required parameter, enforced by an ESLint rule banning Prisma imports elsewhere. A missing `userId` becomes a TypeScript error, not a silent leak. **This ESLint-enforced boundary is the single highest-leverage control in the plan** — it converts the dominant risk (IDOR) from "remember to check every time" into a compile-time guarantee.

### Input validation strategy

Shared Zod schemas in `lib/schemas/*` — pure, importable by client and server, but **the server re-validates from scratch on every mutation; client validation is assumed hostile.** Every Server Action/Route Handler's first two statements are `requireUserId()` then `schema.parse(...)` before any I/O. Mutation schemas use `.strict()` so an extra `userId`/`id` is a 400, not silently stripped — and are always distinct types from the Prisma model, never derived from it. Search/filter inputs are parsed into a closed shape (enum `sortBy`, bounded `take`) rather than passed through as a raw object, which is what prevents both column-injection and unbounded-result DoS. Raw SQL is forbidden by default; if ever needed, tagged-template `$queryRaw` only, `$queryRawUnsafe`/`$executeRawUnsafe` banned via lint rule.

### Secrets management

`.env*` git-ignored from the first commit (with `.env.example` as the sole exception, listing every required key with placeholder values); `NEXT_PUBLIC_` is a publication decision, not a convenience prefix — a CI check greps for secret-shaped names under that prefix; env vars are Zod-validated at boot, split into server/client schemas, with the server schema module marked `server-only`; `AUTH_SECRET` generated per-environment via CSPRNG, rotated immediately on any suspected leak; `DATABASE_URL` uses a least-privilege app role and `sslmode=require` for any non-localhost database.

### Data protection

No plaintext secrets in the DB (OAuth + database sessions means no user passwords to store at all in the recommended configuration); HTTPS assumed in production with HSTS and standard security headers (`X-Content-Type-Options`, `X-Frame-Options`/CSP `frame-ancestors`, `Referrer-Policy`); authenticated data routes are never statically or CDN-cached (`Cache-Control: private, no-store` — a misconfigured cache serving user A's dashboard to user B is a full IDOR requiring zero attacker skill); rate limiting on auth endpoints once they exist; client-facing errors never include Prisma/Zod internals or stack traces, and logs never include transaction amounts or descriptions; CSV export escapes leading `= + - @` characters and serves as an attachment, never `text/html`.

### Dependency & security hygiene

Committed lockfile with `npm ci` in CI (never `npm install`); `npm audit --audit-level=high` failing the build; Next.js and Auth.js kept aggressively patched (both have shipped auth-relevant CVEs); minimal dependency surface, with particular scrutiny on chart libraries since they render user-controlled strings; every generated Prisma migration reviewed by a human before it runs anywhere shared.

### Acceptance checklist (PR gate)

- [ ] No route/action/RSC reads or writes a record without a `userId` sourced from `requireUserId()` in the `where`/`data`
- [ ] `userId` appears in zero input schemas, bodies, query params, or hidden fields
- [ ] Every mutation uses `updateMany`/`deleteMany` with `{ id, userId }`, never a bare `{ id }`
- [ ] No `prisma.` reference exists outside `server/data/**` (lint rule passing)
- [ ] Not-found and not-owned return the same 404 — no existence oracle
- [ ] Every mutation schema is `.strict()` and distinct from the Prisma model type
- [ ] All list endpoints bound `take` and use an enum for `sortBy`/`sortDir`
- [ ] No `$queryRawUnsafe`/`$executeRawUnsafe` anywhere
- [ ] All monetary values are `z.number().int()` cents with explicit bounds — no float ever
- [ ] `.env*` is git-ignored; no secret ever appears in git history; no `NEXT_PUBLIC_*` holds a secret
- [ ] No `dangerouslySetInnerHTML` in transaction/category/goal rendering; chart tooltips take plain text/React nodes, never HTML strings
- [ ] Authenticated data responses are never cached publicly
- [ ] `package-lock.json` committed; CI runs `npm ci` + `npm audit --audit-level=high`
- [ ] **(MVP-phase only, retire once auth lands)** every table has non-null `userId` from migration one; `requireUserId()` throws in production without auth configured; the pre-auth build is documented as localhost-only

---

## 9. Testing Plan

### Strategy — the testing pyramid

```
        /\        E2E (Playwright)          ~8 flows      slow, high confidence
       /  \       Integration (Vitest+DB)   ~40 tests     medium
      /    \      Unit (Vitest, pure)       ~80 tests     fast, cheap
     /______\
```

**Vitest unit** (no DB, pure functions): Zod schema validation (valid/invalid/boundary), money/cents parsing and formatting, aggregate calculations (monthly totals, budget-vs-actual, goal progress) written as pure functions over plain arrays, date/month-boundary helpers. **Vitest integration** (real test Postgres, no mocks): Prisma query correctness, server actions end-to-end at the server boundary, and — critically — **all per-user isolation tests live here**, since this is the layer where ownership scoping actually happens. **Playwright E2E**: critical user journeys only against a real dev server and seeded DB; does not duplicate calculation coverage, only verifies wiring and rendering.

**Key architectural recommendation:** extract every money calculation into pure functions in `lib/` that take and return plain data, rather than letting aggregation logic live inside Prisma queries or components — this is what makes cents/rounding correctness cheaply testable at the unit level. Where a Prisma `groupBy`/`sum` is used for performance, add an integration test asserting the DB aggregate matches the pure-function result over identical fixture data, guarding against the two implementations drifting.

**Test database:** dedicated Postgres via `.env.test`, `prisma migrate deploy` before the integration run (tests exercise the real migrated schema, not an assumption of it), truncate-and-seed per test. **No mocking of Prisma** — the whole value of this layer is exercising real SQL; a mocked test passing while the real query breaks is worse than no test.

**Auth seam for testing:** server actions take the acting user id from the single `requireUserId()` seam; tests stub that seam to switch identities. When Auth.js lands, only the seam's implementation changes and the entire isolation suite keeps working unchanged, immediately validating the real auth wiring.

### Test cases by feature (representative highlights — full detail owned by the eng team during implementation)

- **Money/cents:** exact parse/format round-trips, no float drift summing hundreds of values, percentage math via integers (not `33.330000000000005`), large-amount precision boundaries.
- **Zod schemas:** boundary and hostile inputs (negative/zero/float amounts, malformed dates, unknown-key stripping/rejection as a mass-assignment guard, client-supplied `userId` ignored).
- **Transactions:** CRUD correctness; rejecting a `categoryId` belonging to another user (cross-user FK injection); date-crossing-month-boundary recalculates both months; delete/edit adjust totals and budget progress correctly.
- **Budgets:** correct spent/remaining/percent at zero-spend, exactly-at-budget, and over-budget; **zero-budget division-by-zero guarded**; month-boundary edge cases (first/last instant of month, leap year, December→January rollover); only expense transactions in the same category count.
- **Savings goals:** progress at 0%, partial, exactly 100%, and overfunded (raw vs. clamped-display values asserted separately); zero/null target guarded against division by zero.
- **Monthly totals:** empty month renders zero (never `null`/`NaN`); isolation across two users seeded in the same month is asserted exactly.
- **Search/filter:** SQL wildcard characters (`%`, `_`) in a search term are escaped and matched literally; combined filters AND correctly; filtered results never leak another user's rows even when the text would match them.
- **Per-user isolation (non-negotiable, dedicated suite):** seed users A and B in parallel, then as B attempt every read and mutation against every one of A's resource ids across all resource types — all must fail (404, not 403, and A's row is byte-identical afterward). Include a **structural guard test** that enumerates every exported server action and asserts it's covered by an isolation test, so newly added actions fail until covered — this is what keeps isolation coverage from rotting as features are added.

### E2E critical paths (Playwright, priority order)

1. Add a transaction and see totals update immediately (highest-value single test in the suite)
2. Edit and delete a transaction, totals stay correct (catches stale-cache/revalidation bugs — the most common Next.js Server Action failure mode)
3. Create a budget and see budget-vs-actual reflect a new transaction
4. Exceed a budget and see the over-budget visual state
5. Create a savings goal and log a contribution
6. Search and filter transactions, including combined filters
7. Create a category and assign it to a transaction
8. Responsive smoke test across mobile/tablet/desktop viewports

Tag flows 1, 3, and 5 as `@smoke` for blocking CI (~90s); run the full suite nightly/on release branches rather than every push. **Once Auth.js lands, add as the new #1:** two browser contexts as different users; user B navigating directly to user A's transaction URL gets 404/redirect — the E2E counterpart of the isolation suite.

### CI / quality gates

Blocking on every PR: lint, `tsc --noEmit` (strict), unit tests, integration tests (Postgres service container), `@smoke`-tagged E2E, `next build`, and `prisma migrate diff --exit-code` (catches a hand-edited schema with no migration). Coverage: a **hard 95% gate on `lib/money.ts` and aggregate logic only** (small, pure, highest-consequence code); a soft ~70% target overall, non-blocking; **no global 100% mandate** (it produces tests written to satisfy a number, not to catch bugs); the isolation suite's structural-guard test is a hard 100%-of-actions gate, since that failure mode is silent and severe. Retry E2E twice on CI for network flake, zero retries locally — a test that only passes on retry is a bug report, not a pass.

---

## 10. Development Phases

| Phase | Goal | Done when |
|---|---|---|
| **0 — Setup & tooling** | Running, lintable, testable skeleton | `npm run dev`/`build` succeed; lint/typecheck/tests pass on a clean checkout; a new contributor can go clone→running using only the README |
| **1 — Data layer & schema** | Migration-backed schema encoding money and ownership correctly from day one | `prisma migrate dev` runs clean from empty; seed populates a browsable dataset; money helper tests pass including rounding/negative edge cases |
| **2 — Core transaction CRUD** | The central object works end to end | Add/edit/delete work through the UI; invalid input is rejected server-side even with client validation bypassed; amounts round-trip with zero precision loss |
| **3 — Categories & budgets** | Transactions become classifiable and comparable against intent | Category deletion behaves per the documented reassign-or-block policy; budget-vs-actual matches hand-computed values on seed data |
| **4 — Savings goals** | Forward-looking tracking alongside spend | Progress computes correctly at 0%, partial, exactly 100%, and over-100%; the progress source of truth (contribution ledger) is documented |
| **5 — Dashboard & charts** | The headline experience | Every dashboard number is reproducible by an independent query; charts render without layout shift; a zero-data account shows a helpful empty state |
| **6 — Search/filter & responsive polish** | Usable at real data volumes and on a phone | Filters combine correctly and are correct against seed data; every primary flow is usable one-handed at 375px with no horizontal scroll |
| **7 — Auth.js integration & isolation retrofit** | Turn the single-tenant prototype into a correctly isolated multi-user app | A dedicated cross-user isolation suite passes; no data-layer function accepts a caller-supplied `userId`; unauthenticated requests to protected routes are rejected server-side |
| **8 — Hardening & test completion** | Close gaps, make the quality bar enforceable | Full Definition of Done (§11) passes end to end on a clean clone |

**Why deferring auth to Phase 7 is deliberate and safe:** no real financial data is ever in the system pre-auth (manual/sample data only, no bank credentials, no PII beyond what a developer types); development runs locally, never publicly deployed before Phase 7 completes; the schema is auth-ready from Phase 1, so Phase 7 threads a session value through existing query paths rather than rewriting them; and it front-loads the genuinely risky, product-defining work (money math, aggregation correctness, UX) while auth integration itself is well-trodden. **The two gates that make this safe:** no public deployment before Phase 7's isolation tests pass, and `userId` foreign keys ship in the Phase 1 migration — if either changes (e.g., a shared staging URL is wanted early), auth moves forward in the sequence.

---

## 11. Acceptance Criteria — Definition of Done

**Functional completeness**
- [ ] Transactions: create, view, edit, delete through the UI
- [ ] Categories: create, edit, delete (per documented in-use policy), assign to transactions
- [ ] Monthly totals: income, expenses, net, correctly displayed for a selected month
- [ ] Budgets: set per category, show actual-vs-budget with over/under state
- [ ] Savings goals: create, edit, show accurate progress
- [ ] Dashboard renders all specified charts from real data
- [ ] Transactions searchable by text and filterable by date/category/amount/type, combining predictably, with URL-persisted filter state
- [ ] Every feature has a real empty state and a real error state
- [ ] Users can sign up, sign in, sign out

**Data integrity & correctness**
- [ ] All monetary values are integer cents — no floating-point money anywhere
- [ ] Money helpers have unit tests covering rounding, zero, and negative values
- [ ] Every dashboard aggregate is verified against an independently computed expected value on a fixed fixture
- [ ] Aggregates are computed in the database, not by loading full tables into application memory
- [ ] Every user-owned table has a `userId` FK with referential integrity enforced
- [ ] Every read/write in the data layer is scoped to the session's user, verified by test, not by inspection
- [ ] Automated cross-user isolation tests confirm user A's data cannot be read or mutated by user B via direct route/API calls with a valid session
- [ ] Deleting a parent record leaves no orphaned or dangling references
- [ ] Migrations apply cleanly from an empty database with no manual steps

**Quality gates**
- [ ] `next build` succeeds with zero TypeScript errors under strict mode; lint passes with zero errors
- [ ] Vitest unit + integration suites pass; Playwright covers the primary happy path of every MVP feature
- [ ] CI runs lint/typecheck/unit/E2E on every change and blocks on failure
- [ ] All primary flows usable at 375px, 768px, and 1280px with no horizontal scroll or clipped controls
- [ ] Interactive elements keyboard-reachable with visible focus indicators; form inputs have associated labels
- [ ] No console errors or unhandled promise rejections during a full walkthrough

**Constraint compliance**
- [ ] No bank integrations, aggregator SDKs, or third-party financial APIs anywhere in dependencies or code
- [ ] Data entry is manual or seeded sample data only
- [ ] No secrets, credentials, or `.env` files committed; `.env.example` lists every required variable with a placeholder
- [ ] Every mutation validates input server-side, independent of client-side validation
- [ ] No user-supplied value is trusted for authorization — `userId` is always derived from the session
- [ ] Error responses contain no stack traces, SQL fragments, or internal paths
- [ ] All database access goes through Prisma's parameterized queries

**Sign-off:** a reviewer has completed a full manual walkthrough on a clean clone following only the README; every checkbox above is checked or has a written, accepted exception recorded in this document.

---

## Ongoing documentation recommendations

- **README as the single onboarding path** — prerequisites, clone-to-running steps, every env var with its purpose, DB setup/migration/seed commands, and how to run each test suite.
- **An ADR log (`docs/adr/`)** for decisions with lasting consequences — the ones already worth recording: integer-cents money representation, deferring auth to Phase 7 with its explicit safety gates, the category-deletion reassign-or-block policy, and the savings-goal progress-via-ledger design.
- **Keep this plan document living, not archival** — update it in the same change as any scope or phase reordering; a stale plan is worse than none.
- **Business rules live next to their enforcement** — Prisma schema comments and Zod schemas should carry units/allowed-values/required-ness rather than only in prose that ages out.

---

## Open items carried forward for implementation (not blocking approval)

- Confirm Auth.js session strategy (database sessions recommended) and provider choice (OAuth-primary recommended) before Phase 7 begins.
- Confirm single-currency-per-user (USD, no FX) remains acceptable — noted as a hard MVP simplification by both product and database design.
- Decide the specific charting composition details (e.g., exact "Other" bucket threshold) during Phase 5 implementation, not before.
