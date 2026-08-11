-- Makes the two composite same-owner foreign keys DEFERRABLE INITIALLY
-- IMMEDIATE: zero behavior change for normal application traffic (they
-- still check immediately, same as before, by default), but now callable
-- via `SET CONSTRAINTS ... DEFERRED` within a single transaction --
-- required by scripts/backfill-owner.ts, which reassigns userId across
-- both a category and its referencing transactions/budgets. Reassigning
-- either side alone always violates a NOT DEFERRABLE constraint
-- immediately after that statement, regardless of which table is updated
-- first, since the two rows can only become consistent again once BOTH
-- updates have run -- found via rehearsing that script against a real
-- database, not assumed.
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_category_same_owner";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_same_owner"
  FOREIGN KEY ("categoryId", "userId") REFERENCES "categories"("id", "userId") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "budgets" DROP CONSTRAINT "budgets_category_same_owner";
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_same_owner"
  FOREIGN KEY ("categoryId", "userId") REFERENCES "categories"("id", "userId") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;
