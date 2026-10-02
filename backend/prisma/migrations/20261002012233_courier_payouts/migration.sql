-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "courierPaidAt" DATETIME;
ALTER TABLE "Delivery" ADD COLUMN "courierPaidById" TEXT;

-- CreateIndex
CREATE INDEX "Delivery_courierId_deliveredAt_idx" ON "Delivery"("courierId", "deliveredAt");
