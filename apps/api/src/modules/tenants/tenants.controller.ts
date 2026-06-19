import type { TenantAiProfile, TenantOverviewRecord } from "@platform/types";
import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import type { AdminAuthContext } from "../../common/admin-protection/admin-auth-context";
import { CurrentAdminAuth } from "../../common/admin-protection/current-admin-auth.decorator";
import { RequirePlatformAdmin, RequireTenantRoles } from "../../common/admin-protection/access-policy.decorator";
import { TenantRole } from "@platform/database";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantAiProfileDto } from "./dto/update-tenant-ai-profile.dto";
import { UpdateAgentInvitationQuotaDto } from "./dto/update-agent-invitation-quota.dto";
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

  @Patch(":tenantSlug/agent-invitation-quota")
  @RequirePlatformAdmin()
  async updateAgentInvitationQuota(
    @Param("tenantSlug") tenantSlug: string,
    @Body() body: UpdateAgentInvitationQuotaDto,
    @CurrentAdminAuth() auth: AdminAuthContext
  ): Promise<TenantOverviewRecord> {
    return this.tenantsService.updateAgentInvitationQuota(tenantSlug, body.quota, auth.userId);
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
