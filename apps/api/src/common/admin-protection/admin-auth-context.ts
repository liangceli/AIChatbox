import type { Request } from "express";
import type { MembershipStatus, TenantRole } from "@platform/database";

export interface AdminAuthContext {
  userId?: string;
  email?: string;
  clerkSubject?: string;
  isPlatformAdmin: boolean;
  tenantId?: string;
  tenantSlug?: string;
  roleName?: TenantRole | null;
  membershipStatus?: MembershipStatus | null;
}

export interface AdminAuthenticatedRequest extends Request {
  adminAuth?: AdminAuthContext;
}
