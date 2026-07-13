DROP INDEX IF EXISTS "Message_tenantId_conversationId_clientMessageId_key";

CREATE UNIQUE INDEX "Message_tenantId_clientMessageId_key"
ON "Message"("tenantId", "clientMessageId");
