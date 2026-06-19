import type { TenantAiProfile, TenantOverviewRecord } from "@platform/types";
import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { RequirePlatformAdmin, RequireTenantRoles } from "../../common/admin-protection/access-policy.decorator";
import { TenantRole } from "@platform/database";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantAiProfileDto } from "./dto/update-tenant-ai-profile.dto";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
@UseGuards(AdminApiGuard)
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenantsService: TenantsService) {}

  @Get()
  @RequirePlatformAdmin()
  async listTenants(): Promise<TenantOverviewRecord[]> {
    return this.tenantsService.listTenants();
  }

  @Post()
  @RequirePlatformAdmin()
  async createTenant(@Body() body: CreateTenantDto): Promise<TenantOverviewRecord> {
    return this.tenantsService.createTenant(body);
  }

  @Get(":tenantSlug/ai-profile")
  @RequireTenantRoles(TenantRole.OWNER)
  async getTenantAiProfile(@Param("tenantSlug") tenantSlug: string): Promise<TenantAiProfile> {
    return this.tenantsService.getTenantAiProfile(tenantSlug);
  }

  @Patch(":tenantSlug/ai-profile")
  @RequireTenantRoles(TenantRole.OWNER)
  async updateTenantAiProfile(
    @Param("tenantSlug") tenantSlug: string,
    @Body() body: UpdateTenantAiProfileDto
  ): Promise<TenantAiProfile> {
    return this.tenantsService.updateTenantAiProfile(tenantSlug, body);
  }
}
