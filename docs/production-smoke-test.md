# Production smoke test

A manual, human-run checklist for verifying a **deployed** build of this app
against its **real** production database. Run it after every deploy that
touches data access, auth, or the PWA surface.

This is a checklist, not a script. Nothing here is automated, and nothing
here should be automated against production — the point is that a person
looks at the real thing with their own eyes, because the failures worth
catching here (a wrong balance, another user's row, a stale cached page) are
exactly the ones a passing test suite can still miss.

**Time:** about 30-45 minutes end to end.

---

## Before you start

- [ ] **You have a dedicated smoke-test account.** Not your personal account
      and not a real user's. Auth is GitHub OAuth with an email allowlist
      (`server/auth.ts` + `ALLOWED_SIGNIN_EMAILS`), so the smoke account's
      GitHub email must be on that allowlist in the production environment.
- [ ] **You know the production URL** and are certain it is production, not a
      preview/staging deployment. Check the URL in the address bar before
      every destructive step.
- [ ] **You can read the production database** (psql or a console) if you
      need to verify cleanup at the end. You do not need write access for the
      main run — only for the optional archived-row cleanup in Teardown.
- [ ] **You have somewhere to record results.** Copy this file, or keep a
      scratch note per section. Record *what you saw*, not just pass/fail.
- [ ] **Nobody is mid-deploy.** A deploy during the run invalidates the
      caching and service-worker checks.

### Ground rules

1. **Every row you create must be obviously fake and obviously yours.**
   Prefix every free-text name/description with:

   ```
   SMOKE TEST — delete me
   ```

   Use amounts that could never be mistaken for real data (`1.11`, `2.22`,
   `3.33`). Never use a plausible amount.

2. **Write down every row you create as you create it.** The teardown
   section depends on it. A row you forget is a row that stays in production.

3. **Never touch a row you did not create in this run.** If you see data that
   is not yours, stop immediately and treat it as a data-isolation incident
   (see the note at the end of Section 8).

4. **If a step fails, finish the teardown anyway.** Leaving fake rows behind
   is a second bug on top of the first.

---

## Section 0 — Install and PWA surface

Do this section first, on a **phone** if you have one. It is the only section
that needs a real mobile device to be meaningful.

- [ ] Load the production URL in a fresh browser profile (or a private
      window). You should land on the sign-in page, not a dashboard.
- [ ] Sign in with the smoke-test account. You land on `/dashboard`.
- [ ] **Icon:** the browser tab shows the app icon (three ascending bars on
      an indigo gradient), not a generic globe/document icon.
- [ ] **Install:** the browser offers "Install" / "Add to Home Screen".
      Install it.
- [ ] **Home-screen icon:** the installed icon is the bar mark, correctly
      centred, with **nothing clipped** — no bar touching or cut off by the
      edge of the icon's circle/squircle. On Android this is the maskable
      icon (`/icon/512-maskable`); clipping here means the safe zone is
      wrong.
- [ ] **Launch:** opening from the home screen opens standalone — no browser
      address bar.
- [ ] **Name:** the icon is labelled "Finance".
- [ ] **Offline fallback (the important one):** with the app open on a data
      page, turn on airplane mode and reload. You must see the dedicated
      "You're offline" page.
      **Confirm there is not a single dollar figure on that screen.** A
      cached balance appearing here is a stop-everything failure — the
      service worker is network-only for all financial routes by design
      (`public/sw.js`, `lib/sw-strategy.ts`).
- [ ] Turn airplane mode off, reload, and confirm the real page returns.

---

## Section 1 — Categories

Categories come first: transactions, budgets, and bills all reference them.

- [ ] Go to **Categories**.
- [ ] **Create:** "Add category" → Name `SMOKE TEST — delete me Cat A` →
      save. It appears in the list.
- [ ] **Create a second:** `SMOKE TEST — delete me Cat B`. Both appear.
- [ ] **Read:** reload the page. Both are still there.
- [ ] **Update:** edit Cat B's name to
      `SMOKE TEST — delete me Cat B renamed`. The list reflects it
      immediately.
- [ ] **Validation:** try saving a category with an empty name. It is
      rejected with a visible message, not silently accepted.
- [ ] **Archive/restore:** archive Cat B, confirm it moves under "Archived",
      then restore it. It returns to the active list.

> **Note for teardown:** categories cannot be deleted through the UI, only
> archived. Record both names.

**Rows created:** `_______________________________________________`

---

## Section 2 — Transactions

- [ ] Go to **Transactions**.
- [ ] **Create an expense:** "Add transaction" → Expense, Amount `1.11`,
      Category `Cat A`, Description `SMOKE TEST — delete me expense`,
      today's date → save.
- [ ] **Create an income:** Income, Amount `2.22`, Description
      `SMOKE TEST — delete me income` → save.
- [ ] **Read:** both rows appear with the right sign and formatting — the
      expense shows as `-$1.11`, the income as `$2.22`. **Check the signs
      carefully**; a sign error is the most consequential display bug this
      app can have.
- [ ] **Update:** edit the expense's amount to `3.33` and its date to a date
      in the *previous* month. The row updates, and the running totals change
      to match.
- [ ] **Date boundary:** confirm the edited transaction now appears under the
      previous month and no longer under this one.
- [ ] **Search:** search for `SMOKE TEST`. Both rows are returned, and
      nothing else.
- [ ] **Filter:** filter by category `Cat A`. Only the expense is returned.
- [ ] **Validation:** try to save a transaction with a non-numeric amount
      (e.g. `abc`). It is rejected with a visible message.
- [ ] Clear all filters before moving on.

**Rows created:** `_______________________________________________`

---

## Section 3 — Budgets

- [ ] Go to **Budgets**.
- [ ] **Create:** "Add budget" → Category `Cat A`, Monthly limit `10.00` for
      the current month → save.
- [ ] **Read:** the budget appears with a progress indicator. With no
      current-month expense against Cat A (you moved it to last month in
      Section 2), it should read as unspent/on track.
- [ ] **Progress is real:** add a temporary expense of `9.99` against Cat A
      dated **today**, described `SMOKE TEST — delete me budget probe`.
      Return to Budgets: the Cat A budget now shows near-full burn.
- [ ] **Over-budget state:** edit that probe transaction's amount to `11.11`.
      The budget now reports **over budget**.
- [ ] **Update:** raise the monthly limit to `20.00`. The status returns to
      on track.
- [ ] **Duplicate guard:** try adding a second budget for Cat A in the same
      month. It is rejected — one budget per category per month.
- [ ] **Delete:** delete the Cat A budget. It disappears from the list.
- [ ] Leave the `budget probe` transaction in place for now; it is deleted in
      teardown.

**Rows created:** `_______________________________________________`

---

## Section 4 — Income sources

- [ ] Go to **Income**.
- [ ] **Create:** "Add income source" → Name
      `SMOKE TEST — delete me Source`, Expected amount `4.44`, a pay day →
      save.
- [ ] **Read:** it appears with the expected amount formatted correctly.
- [ ] **Update:** edit the expected amount to `5.55`. The list reflects it.
- [ ] **Validation:** try an empty name and a negative amount; both are
      rejected.
- [ ] **Archive/restore:** archive it, confirm it moves to "Archived", then
      restore it.

> **Note for teardown:** income sources archive, they do not delete.

**Rows created:** `_______________________________________________`

---

## Section 5 — Recurring bills

- [ ] Go to **Bills**.
- [ ] **Create:** "Add bill" → Name `SMOKE TEST — delete me Bill`, Amount
      `6.66`, Due day = today's day of month, Category `Cat A` → save.
- [ ] **Read:** it appears marked **unpaid** for the current month.
- [ ] **Mark paid, without a transaction:** mark it paid with the
      "Log an expense transaction for this payment" option **unchecked**.
      Status flips to paid.
- [ ] Go to **Transactions** and confirm **no** new transaction was created.
      Return to Bills and undo/reset the paid state if the UI allows it.
- [ ] **Mark paid, with a transaction:** mark it paid with that option
      **checked**. Then go to Transactions and confirm exactly **one** new
      expense of `6.66` against Cat A now exists.
      **Record it — this is a row the bill created on your behalf and
      teardown must delete it too.**
- [ ] **Update:** edit the bill's amount to `7.77`.
- [ ] **Archive/restore:** archive the bill, confirm it moves to "Archived",
      then restore it.

**Rows created (including the auto-created transaction):**
`_______________________________________________`

---

## Section 6 — Savings goals

- [ ] Go to **Goals**.
- [ ] **Create:** "Add goal" → Name `SMOKE TEST — delete me Goal`, Target
      amount `100.00`, a target date → save.
- [ ] **Read:** it shows 0% progress against a $100.00 target.
- [ ] **Contribute:** add a contribution of `25.00`. Progress updates to 25%.
- [ ] **Contribute again:** add `10.00`. Progress updates to 35% and the
      contribution history shows both entries.
- [ ] **Update:** edit the goal's target to `70.00`. Progress recalculates
      (50%) rather than staying stale.
- [ ] **Completed state:** contribute enough to exceed the target and confirm
      the goal moves to / is marked completed. Then reverse or note it.
- [ ] **Validation:** try a zero or negative target amount; it is rejected.
- [ ] **Delete:** delete the goal. Confirm it disappears **and** its
      contributions go with it (no orphaned contribution rows visible
      anywhere).

**Rows created:** `_______________________________________________`

---

## Section 7 — History and Dashboard (read-only verification)

These two pages only read. They are where a computation bug surfaces.

- [ ] Go to **History**. The current month's row reflects the smoke
      transactions still outstanding (the budget probe at `11.11` and the
      bill's `6.66` expense).
- [ ] The previous month's row reflects the `3.33` expense you moved there.
- [ ] Income of `2.22` is counted as income, not netted against expenses
      incorrectly. Net = income − expenses for that month; verify the
      arithmetic by hand.
- [ ] Go to **Dashboard**. Total income, total expenses, and net for the
      current month agree with what History shows. **Any disagreement
      between these two pages is a real bug — stop and report it.**
- [ ] The category breakdown chart shows Cat A with the expected total.
- [ ] The monthly trend chart includes the previous month (with the `3.33`)
      and does not omit months with no data.
- [ ] Every figure on both pages is formatted as currency with two decimals —
      no raw cents (`333`), no floating-point artefacts (`3.3300000000000005`).

---

## Section 8 — Cross-cutting checks

- [ ] **Session persistence:** close the tab, reopen the app. You are still
      signed in.
- [ ] **Sign out:** sign out, then navigate directly to `/dashboard`,
      `/transactions`, and `/history` by typing the URLs. Each redirects to
      sign-in. **None of them flashes real data before redirecting.**
- [ ] **Back button after sign-out:** press the browser Back button after
      signing out. You must not see a cached copy of a data page.
- [ ] **Deep link while signed out:** open `/transactions` in a fresh private
      window. It redirects to sign-in and does not leak row data.
- [ ] **Mobile layout:** on a phone-width viewport, open the nav drawer,
      navigate to two pages, and confirm nothing overflows horizontally and
      the drawer closes on navigation.
- [ ] Sign back in as the smoke account to perform teardown.

> **Data isolation:** if at any point you see a row you did not create in
> this run, stop the smoke test, do not delete anything, capture screenshots
> and the URL, and escalate. That is a cross-user data leak, which is the
> most serious failure this application can have.

---

## Section 9 — Teardown (mandatory)

Work in this order — children before parents — or you will hit
in-use/reference errors.

**Delete (hard, through the UI):**

- [ ] Every transaction created in Sections 2, 3, and 5, **including the one
      the bill created when marked paid**. Search `SMOKE TEST` on the
      Transactions page and delete every result.
- [ ] Any remaining budget from Section 3.
- [ ] The savings goal from Section 6, if it still exists.

**Archive (the UI offers nothing stronger):**

- [ ] The recurring bill from Section 5.
- [ ] The income source from Section 4.
- [ ] Both categories from Section 1 (archive last — transactions and bills
      reference them).

**Verify through the UI:**

- [ ] Search `SMOKE TEST` on Transactions with all filters cleared and all
      date ranges widened: **zero results**.
- [ ] Budgets, Goals, Bills, Income: no `SMOKE TEST` entry in the active
      lists.
- [ ] Dashboard and History totals are back to what they were before the run
      (they should exclude archived-but-empty categories entirely).

### Archived rows are still in the database

Categories, income sources, and recurring bills **archive rather than
delete** — there is no hard-delete path in the UI (`archiveCategory`,
`archiveIncomeSource`, `archiveRecurringBill` in `server/data/`). After the
steps above, three clearly-labelled archived rows remain in production.

That is acceptable if and only if they stay labelled: they are invisible on
every active list, excluded from every total, and named
`SMOKE TEST — delete me`. Leaving them is the low-risk choice.

If you want them gone, remove them directly, and **only** with a dry run
first:

- [ ] Confirm the smoke account's user id, and confirm you are connected to
      production deliberately.
- [ ] **Dry run — `SELECT` first, always.** List the exact rows you intend to
      remove, scoped to the smoke account's `userId` *and* to the
      `SMOKE TEST` name prefix. Read the result. Confirm the count is what
      you expect and that every row is one you created today.
- [ ] Only then delete those specific rows by id — never by name pattern
      alone, and never without the `userId` scope.
- [ ] Re-run the `SELECT`. It returns nothing.

> Never run an unscoped `DELETE` against production. If the dry run returns
> anything you did not create, stop and escalate instead of deleting.

---

## Sign-off

| Field | Value |
|---|---|
| Date | |
| Deployed commit / version | |
| Production URL | |
| Smoke account | |
| Device(s) used | |
| Sections passed | |
| Failures found (with links to issues) | |
| Teardown verified clean by | |

- [ ] Every section above is checked, or has a recorded failure with an
      issue filed.
- [ ] Teardown verified: no `SMOKE TEST` data is visible in the running app.
- [ ] Result recorded and shared with whoever owns the release.
