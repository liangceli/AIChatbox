CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'AGENT');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

ALTER TABLE "User" ADD COLUMN "clerkUserId" TEXT;
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

ALTER TABLE "Role" ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Role" ALTER COLUMN "name" TYPE "TenantRole"
USING CASE
  WHEN UPPER("name") IN ('ADMIN', 'OWNER', 'SUPPORT_ADMIN', 'TENANT_OWNER') THEN 'OWNER'::"TenantRole"
  ELSE 'AGENT'::"TenantRole"
END;
CREATE INDEX "Role_userId_status_idx" ON "Role"("userId", "status");

CREATE TABLE "TenantInvitation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "invitedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantInvitation_tokenHash_key" ON "TenantInvitation"("tokenHash");
CREATE INDEX "TenantInvitation_tenantId_email_expiresAt_idx" ON "TenantInvitation"("tenantId", "email", "expiresAt");
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "outcome" TEXT NOT NULL,
  "requestId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "User"
SET "clerkUserId" = COALESCE(
  "metadata"->>'clerkUserId',
  "metadata"->>'clerkSubject',
  "metadata"->>'clerk_user_id'
)
WHERE "metadata" IS NOT NULL;
