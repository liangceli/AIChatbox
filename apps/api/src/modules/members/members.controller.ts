import { TenantRole } from "@platform/database";
import type {
  CreatedTenantInvitation,
  TenantInvitationPolicyRecord,
  TenantInvitationRecord,
  TenantMemberRecord
} from "@platform/types";
import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RequireTenantRoles } from "../../common/admin-protection/access-policy.decorator";
import type { AdminAuthContext } from "../../common/admin-protection/admin-auth-context";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { CurrentAdminAuth } from "../../common/admin-protection/current-admin-auth.decorator";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { UpdateMembershipStatusDto } from "./dto/update-membership-status.dto";
import { MembersService } from "./members.service";

@Controller("members")
@UseGuards(AdminApiGuard)
@RequireTenantRoles(TenantRole.OWNER)
export class MembersController {
  constructor(@Inject(MembersService) private readonly membersService: MembersService) {}

  @Get()
  listMembers(@CurrentTenant() tenant: ResolvedTenant): Promise<TenantMemberRecord[]> {
    return this.membersService.listMembers(tenant);
  }

  @Get("invitations")
  listInvitations(@CurrentTenant() tenant: ResolvedTenant): Promise<TenantInvitationRecord[]> {
    return this.membersService.listInvitations(tenant);
  }

  @Get("invitation-policy")
  getInvitationPolicy(@CurrentTenant() tenant: ResolvedTenant): Promise<TenantInvitationPolicyRecord> {
    return this.membersService.getInvitationPolicy(tenant);
  }

  @Post("invitations")
  createInvitation(
    @CurrentTenant() tenant: ResolvedTenant,
    @CurrentAdminAuth() auth: AdminAuthContext,
    @Body() body: CreateInvitationDto
  ): Promise<CreatedTenantInvitation> {
    return this.membersService.createInvitation(tenant, auth, body);
  }

  @Post("invitations/:invitationId/revoke")
  revokeInvitation(
    @CurrentTenant() tenant: ResolvedTenant,
    @CurrentAdminAuth() auth: AdminAuthContext,
    @Param("invitationId") invitationId: string
  ): Promise<TenantInvitationRecord> {
    return this.membersService.revokeInvitation(tenant, auth, invitationId);
  }

  @Patch(":userId/status")
  updateMembershipStatus(
    @CurrentTenant() tenant: ResolvedTenant,
    @CurrentAdminAuth() auth: AdminAuthContext,
    @Param("userId") userId: string,
    @Body() body: UpdateMembershipStatusDto
  ): Promise<TenantMemberRecord> {
    return this.membersService.updateMembershipStatus(tenant, auth, userId, body.status);
  }
}
