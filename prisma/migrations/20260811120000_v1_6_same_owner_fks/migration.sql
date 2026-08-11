-- Extends the database-level tenant-isolation backstop that so far covered
-- only transaction->category and budget->category (see
-- 20260805014549_init's "same_owner" block) to every remaining relation
-- that links two user-owned rows. Until now those five relied on
-- application-level ownership checks in server/data/** alone; a single
-- missed `userId` in a future `where` clause was enough to write a
-- cross-user link that nothing would reject. Now Postgres refuses it.

-- CreateIndex
-- The referenced side of a composite foreign key must carry a unique
-- constraint on exactly those columns, which is why these four mirror
-- Category's existing @@unique([id, userId]). Each is redundant on its own
-- (id is already the primary key, so (id, userId) can never repeat) and
-- exists purely to give the constraints below something to point at.
CREATE UNIQUE INDEX "income_sources_id_userId_key" ON "income_sources"("id", "userId");
CREATE UNIQUE INDEX "recurring_bills_id_userId_key" ON "recurring_bills"("id", "userId");
CREATE UNIQUE INDEX "savings_goals_id_userId_key" ON "savings_goals"("id", "userId");
CREATE UNIQUE INDEX "transactions_id_userId_key" ON "transactions"("id", "userId");

-- ---------------------------------------------------------------------------
-- Hand-written additions below this line, same as 20260805014549_init:
-- Prisma's schema DSL cannot express composite foreign keys onto
-- non-primary-key columns.
--
-- These are added ALONGSIDE the existing single-column FKs, never in place
-- of them -- exactly as init did for the two Category constraints. That is
-- load-bearing, not stylistic: a composite `ON DELETE SET NULL` nulls EVERY
-- column in the key, `userId` included, and `userId` is NOT NULL. Deleting
-- a parent row with the plain FK dropped therefore fails outright with
-- 23502 (verified against a real database, not assumed). With the plain FK
-- still present, its narrower single-column SET NULL runs first, and the
-- now-NULL child column exempts the row from the composite under
-- MATCH SIMPLE -- so the delete succeeds and `userId` survives.
--
-- All five are DEFERRABLE INITIALLY IMMEDIATE for the same reason as
-- 20260811075601_defer_same_owner_fks: no behavior change for normal
-- application traffic (still checked immediately), but scripts/backfill-owner.ts
-- can `SET CONSTRAINTS ... DEFERRED` to reassign both sides of a relation
-- within one transaction, which no statement ordering can otherwise satisfy.
-- ---------------------------------------------------------------------------

-- Nullable child columns (incomeSourceId, categoryId, transactionId) are
-- exempted from the check whenever they are NULL: Postgres's default
-- MATCH SIMPLE skips the constraint if ANY column of the key is NULL. This
-- is the same behavior the existing nullable transactions_category_same_owner
-- already depends on, so "not every transaction has an income source" keeps
-- working unchanged.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_income_source_same_owner"
  FOREIGN KEY ("incomeSourceId", "userId") REFERENCES "income_sources"("id", "userId") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_goal_same_owner"
  FOREIGN KEY ("goalId", "userId") REFERENCES "savings_goals"("id", "userId") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "recurring_bill_payments" ADD CONSTRAINT "recurring_bill_payments_bill_same_owner"
  FOREIGN KEY ("billId", "userId") REFERENCES "recurring_bills"("id", "userId") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_category_same_owner"
  FOREIGN KEY ("categoryId", "userId") REFERENCES "categories"("id", "userId") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

-- ON DELETE SET NULL matches the existing plain
-- recurring_bill_payments_transactionId_fkey, so deleting a transaction
-- still detaches the payment row rather than deleting the paid-status
-- record it represents.
ALTER TABLE "recurring_bill_payments" ADD CONSTRAINT "recurring_bill_payments_transaction_same_owner"
  FOREIGN KEY ("transactionId", "userId") REFERENCES "transactions"("id", "userId") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
