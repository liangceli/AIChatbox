import { randomBytes } from "node:crypto";
import { MembershipStatus, TenantRole } from "@platform/database";
import type { CreatedTenantInvitation, TenantInvitationRecord, TenantMemberRecord } from "@platform/types";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminAuthContext } from "../../common/admin-protection/admin-auth-context";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { hashInvitationToken } from "../account/account.service";
import type { CreateInvitationDto } from "./dto/create-invitation.dto";

@Injectable()
export class MembersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listMembers(tenant: ResolvedTenant): Promise<TenantMemberRecord[]> {
    const memberships = await this.prisma.client.role.findMany({
      where: { tenantId: tenant.id },
      include: { user: true },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }]
    });

    return memberships.map(toMemberRecord);
  }

  async listInvitations(tenant: ResolvedTenant): Promise<TenantInvitationRecord[]> {
    const invitations = await this.prisma.client.tenantInvitation.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return invitations.map(toInvitationRecord);
  }

  async createInvitation(
    tenant: ResolvedTenant,
    auth: AdminAuthContext,
    input: CreateInvitationDto
  ): Promise<CreatedTenantInvitation> {
    const actorUserId = requireActor(auth);

    if (!auth.isPlatformAdmin && input.role !== TenantRole.AGENT) {
      throw new ForbiddenException("Tenant owners can invite agents only.");
    }

    const email = input.email.trim().toLowerCase();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000);
    const invitation = await this.prisma.client.$transaction(async (tx) => {
      await tx.tenantInvitation.updateMany({
        where: {
          tenantId: tenant.id,
          email,
          acceptedAt: null,
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
      const created = await tx.tenantInvitation.create({
        data: {
          tenantId: tenant.id,
          email,
          role: input.role,
          tokenHash: hashInvitationToken(token),
          expiresAt,
          invitedByUserId: actorUserId
        }
      });
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId,
          action: "membership.invitation.created",
          resourceType: "tenant_invitation",
          resourceId: created.id,
          outcome: "success",
          metadata: { role: input.role }
        }
      });
      return created;
    });

    return { ...toInvitationRecord(invitation), token };
  }

  async revokeInvitation(
    tenant: ResolvedTenant,
    auth: AdminAuthContext,
    invitationId: string
  ): Promise<TenantInvitationRecord> {
    const actorUserId = requireActor(auth);
    const invitation = await this.prisma.client.tenantInvitation.findFirst({
      where: { id: invitationId, tenantId: tenant.id }
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found.");
    }

    if (!auth.isPlatformAdmin && invitation.role !== TenantRole.AGENT) {
      throw new ForbiddenException("Tenant owners can revoke agent invitations only.");
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const record = await tx.tenantInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() }
      });
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId,
          action: "membership.invitation.revoked",
          resourceType: "tenant_invitation",
          resourceId: record.id,
          outcome: "success"
        }
      });
      return record;
    });

    return toInvitationRecord(updated);
  }

  async updateMembershipStatus(
    tenant: ResolvedTenant,
    auth: AdminAuthContext,
    userId: string,
    status: MembershipStatus
  ): Promise<TenantMemberRecord> {
    const actorUserId = requireActor(auth);

    if (actorUserId === userId) {
      throw new BadRequestException("You cannot change your own tenant access.");
    }

    const membership = await this.prisma.client.role.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId } },
      include: { user: true }
    });

    if (!membership) {
      throw new NotFoundException("Tenant member not found.");
    }

    if (!auth.isPlatformAdmin && membership.name !== TenantRole.AGENT) {
      throw new ForbiddenException("Tenant owners can manage agent memberships only.");
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const record = await tx.role.update({
        where: { tenantId_userId: { tenantId: tenant.id, userId } },
        data: { status },
        include: { user: true }
      });
      if (status !== MembershipStatus.ACTIVE) {
        await tx.conversation.updateMany({
          where: {
            tenantId: tenant.id,
            assignedUserId: userId,
            status: "PENDING_HUMAN"
          },
          data: { assignedUserId: null }
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId,
          action: "membership.status.changed",
          resourceType: "tenant_membership",
          resourceId: record.id,
          outcome: "success",
          metadata: { status }
        }
      });
      return record;
    });

    return toMemberRecord(updated);
  }
}

function requireActor(auth: AdminAuthContext): string {
  if (!auth.userId) {
    throw new ForbiddenException("A mapped account is required.");
  }
  return auth.userId;
}

function toMemberRecord(membership: {
  name: TenantRole;
  status: MembershipStatus;
  user: { id: string; email: string; name: string | null };
}): TenantMemberRecord {
  return {
    userId: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    role: membership.name.toLowerCase() as "owner" | "agent",
    status: membership.status.toLowerCase() as "active" | "suspended" | "revoked"
  };
}

function toInvitationRecord(invitation: {
  id: string;
  email: string;
  role: TenantRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): TenantInvitationRecord {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role.toLowerCase() as "owner" | "agent",
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString()
  };
}
