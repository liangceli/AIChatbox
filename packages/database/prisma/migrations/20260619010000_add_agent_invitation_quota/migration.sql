ALTER TABLE "Tenant"
ADD COLUMN "agentInvitationQuota" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "Tenant"
ADD CONSTRAINT "Tenant_agentInvitationQuota_check"
CHECK ("agentInvitationQuota" >= 0 AND "agentInvitationQuota" <= 5);
