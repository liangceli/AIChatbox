import type { PublicTenantAiProfile } from "@platform/types";
import { Controller, Get, Inject } from "@nestjs/common";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { TenantsService } from "./tenants.service";

@Controller("tenant-profile")
export class PublicTenantProfileController {
  constructor(@Inject(TenantsService) private readonly tenantsService: TenantsService) {}

  @Get()
  async getPublicTenantProfile(
    @CurrentTenant() tenant: ResolvedTenant
  ): Promise<PublicTenantAiProfile> {
    return this.tenantsService.getPublicTenantAiProfile(tenant);
  }
}
