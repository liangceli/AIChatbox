-- CreateTable
CREATE TABLE "ProductCatalog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "catalogKey" TEXT NOT NULL,
    "productSeries" TEXT,
    "productName" TEXT NOT NULL,
    "modelNumber" TEXT,
    "deviceType" TEXT,
    "aliases" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationState" (
    "conversationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "activeProductCatalogId" TEXT,
    "activeProductContext" JSONB,
    "activeConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activeEntitySource" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "stateJson" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("conversationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalog_id_tenantId_key" ON "ProductCatalog"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalog_tenantId_catalogKey_key" ON "ProductCatalog"("tenantId", "catalogKey");

-- CreateIndex
CREATE INDEX "ProductCatalog_tenantId_productName_idx" ON "ProductCatalog"("tenantId", "productName");

-- CreateIndex
CREATE INDEX "ProductCatalog_tenantId_modelNumber_idx" ON "ProductCatalog"("tenantId", "modelNumber");

-- CreateIndex
CREATE INDEX "ProductCatalog_tenantId_productSeries_idx" ON "ProductCatalog"("tenantId", "productSeries");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_conversationId_tenantId_key" ON "ConversationState"("conversationId", "tenantId");

-- CreateIndex
CREATE INDEX "ConversationState_tenantId_activeProductCatalogId_idx" ON "ConversationState"("tenantId", "activeProductCatalogId");

-- CreateIndex
CREATE INDEX "ConversationState_tenantId_updatedAt_idx" ON "ConversationState"("tenantId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ProductCatalog" ADD CONSTRAINT "ProductCatalog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_conversationId_tenantId_fkey" FOREIGN KEY ("conversationId", "tenantId") REFERENCES "Conversation"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_activeProductCatalogId_fkey" FOREIGN KEY ("activeProductCatalogId") REFERENCES "ProductCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
