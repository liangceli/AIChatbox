ALTER TABLE "Customer"
ADD COLUMN "visitorId" TEXT;

UPDATE "Customer"
SET "visitorId" = "externalId"
WHERE "visitorId" IS NULL
  AND "externalId" IS NOT NULL;

CREATE UNIQUE INDEX "Customer_tenantId_visitorId_key" ON "Customer"("tenantId", "visitorId");
CREATE INDEX "Customer_tenantId_visitorId_idx" ON "Customer"("tenantId", "visitorId");
