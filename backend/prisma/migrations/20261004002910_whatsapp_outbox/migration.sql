-- CreateTable
CREATE TABLE "WhatsAppOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL,
    "payload" TEXT,
    "meta" TEXT,
    "idempotencyKey" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "lastError" TEXT,
    "messageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppOutbox_idempotencyKey_key" ON "WhatsAppOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WhatsAppOutbox_status_priority_nextAttemptAt_idx" ON "WhatsAppOutbox"("status", "priority", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WhatsAppOutbox_phone_sentAt_idx" ON "WhatsAppOutbox"("phone", "sentAt");
