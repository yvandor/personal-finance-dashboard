-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "type" "CategoryType" NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#64748b',
    "icon" VARCHAR(40),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "date" DATE NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "notes" VARCHAR(1000),
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "targetCents" INTEGER NOT NULL,
    "startingCents" INTEGER NOT NULL DEFAULT 0,
    "targetDate" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "color" VARCHAR(7) NOT NULL DEFAULT '#0ea5e9',
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_contributions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "categories_userId_isArchived_sortOrder_idx" ON "categories"("userId", "isArchived", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_type_name_key" ON "categories"("userId", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_id_userId_key" ON "categories"("id", "userId");

-- CreateIndex
CREATE INDEX "transactions_userId_date_id_idx" ON "transactions"("userId", "date" DESC, "id");

-- CreateIndex
CREATE INDEX "transactions_userId_categoryId_date_idx" ON "transactions"("userId", "categoryId", "date");

-- CreateIndex
CREATE INDEX "transactions_userId_type_date_idx" ON "transactions"("userId", "type", "date");

-- CreateIndex
CREATE INDEX "transactions_userId_amountCents_idx" ON "transactions"("userId", "amountCents");

-- CreateIndex
CREATE INDEX "budgets_userId_periodStart_idx" ON "budgets"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_userId_categoryId_periodStart_key" ON "budgets"("userId", "categoryId", "periodStart");

-- CreateIndex
CREATE INDEX "savings_goals_userId_status_targetDate_idx" ON "savings_goals"("userId", "status", "targetDate");

-- CreateIndex
CREATE UNIQUE INDEX "savings_goals_userId_name_key" ON "savings_goals"("userId", "name");

-- CreateIndex
CREATE INDEX "savings_contributions_goalId_date_idx" ON "savings_contributions"("goalId", "date");

-- CreateIndex
CREATE INDEX "savings_contributions_userId_date_idx" ON "savings_contributions"("userId", "date");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written additions below this line. Prisma's schema DSL cannot express
-- CHECK constraints or composite foreign keys onto non-primary-key columns,
-- so these are added directly to the generated migration. They are as
-- load-bearing as the schema above, not optional polish.
-- ---------------------------------------------------------------------------

-- Money is always a positive magnitude; direction is carried by `type`/`status`,
-- never by sign. Catches an application bug at the database, not just in Zod.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive" CHECK ("amountCents" > 0);
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_amount_nonneg" CHECK ("amountCents" >= 0);
ALTER TABLE "savings_goals" ADD CONSTRAINT "goals_target_positive" CHECK ("targetCents" > 0);
ALTER TABLE "savings_goals" ADD CONSTRAINT "goals_starting_nonneg" CHECK ("startingCents" >= 0);

-- No empty/whitespace-only descriptions slipping past a VARCHAR(200).
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_description_nonempty" CHECK (length(btrim("description")) > 0);

-- Budget periods are always the first of a month (enforces the model's
-- documented invariant at the database, not just in application code).
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_period_is_month_start" CHECK ("periodStart" = date_trunc('month', "periodStart")::date);

-- Sanity bound on dates, guarding against typo/import bugs rather than
-- encoding a real business rule.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_date_sane" CHECK ("date" >= DATE '1970-01-01' AND "date" < DATE '2100-01-01');

-- Database-level backstop for tenant isolation: a transaction or budget may
-- only reference a category owned by the SAME user. Even a future
-- application bug that scopes the transaction row by session user but looks
-- up the category by raw id cannot write a cross-user link — Postgres
-- rejects it outright. This is why Category has @@unique([id, userId]).
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_same_owner"
  FOREIGN KEY ("categoryId", "userId") REFERENCES "categories"("id", "userId") ON DELETE SET NULL;

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_same_owner"
  FOREIGN KEY ("categoryId", "userId") REFERENCES "categories"("id", "userId") ON DELETE CASCADE;

-- Substring search on transaction descriptions ("star" -> "Starbucks") needs
-- a trigram index. Postgres full-text search is lexeme/word-based and would
-- miss partial matches on merchant names, which are often not real words.
-- pg_trgm is a "trusted" extension (installable by the database owner
-- without superuser) as of Postgres 13+.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "transactions_description_trgm_idx" ON "transactions" USING GIN ("description" gin_trgm_ops);
