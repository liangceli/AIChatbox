import type { TenantBranding } from "@platform/types";
import { slugify } from "@platform/utils";

export interface TenantRuntimeConfig {
  slug: string;
  branding: TenantBranding;
  defaultLocale?: string;
  escalationPolicy?: {
    enabled: boolean;
    queue?: string;
  };
  integrationKeys?: string[];
}

export function buildTenantRuntimeKey(slug: string): string {
  return `tenant:${slugify(slug)}`;
}

export function assertTenantMatch(expectedTenantId: string, actualTenantId: string): void {
  if (expectedTenantId !== actualTenantId) {
    throw new Error("Cross-tenant access attempt detected");
  }
}
