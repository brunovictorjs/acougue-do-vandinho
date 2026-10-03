-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN "deliveryCode" TEXT NOT NULL DEFAULT '';

-- Backfill: deliveries created before the delivery code existed get one now,
-- so no open delivery can be completed without the customer's code.
UPDATE "Delivery"
SET "deliveryCode" = substr('000000' || CAST(abs(random()) % 1000000 AS TEXT), -6, 6)
WHERE "deliveryCode" = '';
