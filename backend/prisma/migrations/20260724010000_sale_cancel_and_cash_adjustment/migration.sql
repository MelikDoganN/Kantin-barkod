-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'SALE_CANCEL';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledById" INTEGER,
ADD COLUMN "cancelReason" TEXT;

-- CreateIndex
CREATE INDEX "Sale_cancelledById_idx" ON "Sale"("cancelledById");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CashAdjustment" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "dayEndId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashAdjustment_userId_idx" ON "CashAdjustment"("userId");
CREATE INDEX "CashAdjustment_dayEndId_idx" ON "CashAdjustment"("dayEndId");
CREATE INDEX "CashAdjustment_createdAt_idx" ON "CashAdjustment"("createdAt");

ALTER TABLE "CashAdjustment" ADD CONSTRAINT "CashAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashAdjustment" ADD CONSTRAINT "CashAdjustment_dayEndId_fkey" FOREIGN KEY ("dayEndId") REFERENCES "DayEnd"("id") ON DELETE SET NULL ON UPDATE CASCADE;
