ALTER TABLE "Message" ADD COLUMN "clientMessageId" TEXT;

CREATE UNIQUE INDEX "Message_tenantId_conversationId_clientMessageId_key"
ON "Message"("tenantId", "conversationId", "clientMessageId");

ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
