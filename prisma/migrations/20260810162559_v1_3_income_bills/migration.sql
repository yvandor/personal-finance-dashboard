-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "incomeSourceId" TEXT;

-- CreateTable
CREATE TABLE "income_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "payDay" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_bills" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "categoryId" TEXT,
    "dueDay" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_bill_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "periodMonth" VARCHAR(7) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_bill_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "income_sources_userId_isActive_idx" ON "income_sources"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "income_sources_userId_name_key" ON "income_sources"("userId", "name");

-- CreateIndex
CREATE INDEX "recurring_bills_userId_isActive_dueDay_idx" ON "recurring_bills"("userId", "isActive", "dueDay");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_bills_userId_name_key" ON "recurring_bills"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_bill_payments_transactionId_key" ON "recurring_bill_payments"("transactionId");

-- CreateIndex
CREATE INDEX "recurring_bill_payments_userId_periodMonth_idx" ON "recurring_bill_payments"("userId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_bill_payments_billId_periodMonth_key" ON "recurring_bill_payments"("billId", "periodMonth");

-- CreateIndex
CREATE INDEX "transactions_userId_incomeSourceId_date_idx" ON "transactions"("userId", "incomeSourceId", "date");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_incomeSourceId_fkey" FOREIGN KEY ("incomeSourceId") REFERENCES "income_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bills" ADD CONSTRAINT "recurring_bills_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bill_payments" ADD CONSTRAINT "recurring_bill_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bill_payments" ADD CONSTRAINT "recurring_bill_payments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "recurring_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_bill_payments" ADD CONSTRAINT "recurring_bill_payments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
