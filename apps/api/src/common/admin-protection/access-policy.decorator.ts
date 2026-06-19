import type { TenantRole } from "@platform/database";
import { SetMetadata } from "@nestjs/common";

export const ACCESS_POLICY_KEY = "admin-access-policy";

export interface AccessPolicy {
  allowUnmapped?: boolean;
  platformOnly?: boolean;
  tenantRoles?: TenantRole[];
}

export const AllowAuthenticatedClerk = () =>
  SetMetadata(ACCESS_POLICY_KEY, { allowUnmapped: true } satisfies AccessPolicy);

export const RequirePlatformAdmin = () =>
  SetMetadata(ACCESS_POLICY_KEY, { platformOnly: true } satisfies AccessPolicy);

export const RequireTenantRoles = (...tenantRoles: TenantRole[]) =>
  SetMetadata(ACCESS_POLICY_KEY, { tenantRoles } satisfies AccessPolicy);
