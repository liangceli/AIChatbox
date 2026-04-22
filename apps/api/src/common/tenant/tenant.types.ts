import type { Tenant, TenantStatus } from "@platform/database";
import type { Request } from "express";

export interface ResolvedTenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
}

export interface TenantRequest extends Request {
  tenant?: ResolvedTenant;
}

export function toResolvedTenant(tenant: Pick<Tenant, "id" | "slug" | "name" | "status">): ResolvedTenant {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status
  };
}
