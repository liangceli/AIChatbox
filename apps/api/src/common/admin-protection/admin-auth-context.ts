import type { Request } from "express";

export interface AdminAuthContext {
  userId: string;
  email: string;
  clerkSubject?: string;
  isPlatformAdmin: boolean;
  tenantSlug?: string;
  roleName?: string | null;
}

export interface AdminAuthenticatedRequest extends Request {
  adminAuth?: AdminAuthContext;
}
