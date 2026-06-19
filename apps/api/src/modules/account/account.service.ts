import { createHash } from "node:crypto";
import { MembershipStatus } from "@platform/database";
import type { AccountRecord } from "@platform/types";
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminAuthContext } from "../../common/admin-protection/admin-auth-context";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AccountService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMe(auth: AdminAuthContext): Promise<AccountRecord> {
    if (!auth.userId) {
      return {
        mapped: false,
        email: auth.email,
        isPlatformAdmin: false,
        memberships: [],
        defaultRoute: "/access-pending"
      };
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: auth.userId },
      include: {
        roles: {
          include: {
            tenant: {
              include: {
                _count: {
                  select: { conversations: true, knowledgeBases: true }
                }
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!user) {
      throw new NotFoundException("Account mapping no longer exists.");
    }

    const pendingCounts = await this.prisma.client.conversation.groupBy({
      by: ["tenantId"],
      where: {
        tenantId: { in: user.roles.map((membership) => membership.tenantId) },
        status: "PENDING_HUMAN"
      },
      _count: { _all: true }
    });
    const pendingByTenant = new Map(pendingCounts.map((entry) => [entry.tenantId, entry._count._all]));
    const memberships = user.roles.map((membership) => ({
      tenantId: membership.tenantId,
      tenantSlug: membership.tenant.slug,
      tenantName: membership.tenant.name,
      role: membership.name.toLowerCase() as "owner" | "agent",
      status: membership.status.toLowerCase() as "active" | "suspended" | "revoked",
      conversationCount: membership.tenant._count.conversations,
      pendingHumanCount: pendingByTenant.get(membership.tenantId) ?? 0,
      knowledgeBaseCount: membership.tenant._count.knowledgeBases
    }));
    const activeMemberships = memberships.filter((membership) => membership.status === "active");
    const defaultRoute = user.isPlatformAdmin || activeMemberships.some((membership) => membership.role === "owner")
      ? "/admin"
      : activeMemberships.some((membership) => membership.role === "agent")
        ? "/agent"
        : "/access-pending";

    return {
      mapped: true,
      userId: user.id,
      email: user.email,
      name: user.name,
      isPlatformAdmin: user.isPlatformAdmin,
      memberships,
      defaultRoute
    };
  }

  async acceptInvitation(auth: AdminAuthContext, token: string): Promise<AccountRecord> {
    if (!auth.clerkSubject) {
      throw new ForbiddenException("A verified Clerk identity is required.");
    }

    const tokenHash = hashInvitationToken(token);
    const now = new Date();
    const userId = await this.prisma.client.$transaction(async (tx) => {
      const invitation = await tx.tenantInvitation.findUnique({ where: { tokenHash } });

      if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now) {
        throw new NotFoundException("Invitation is invalid or expired.");
      }

      const subjectUser = await tx.user.findUnique({ where: { clerkUserId: auth.clerkSubject } });
      const emailUser = await tx.user.findUnique({ where: { email: invitation.email } });
      const user = subjectUser ?? emailUser;

      if (subjectUser && emailUser && subjectUser.id !== emailUser.id) {
        throw new ConflictException("Invitation identity conflicts with an existing account.");
      }

      if (user?.clerkUserId && user.clerkUserId !== auth.clerkSubject) {
        throw new ConflictException("Invitation is already bound to another Clerk identity.");
      }

      const savedUser = user
        ? await tx.user.update({
            where: { id: user.id },
            data: { clerkUserId: auth.clerkSubject }
          })
        : await tx.user.create({
            data: {
              email: invitation.email,
              clerkUserId: auth.clerkSubject
            }
          });

      const otherActiveMembership = await tx.role.findFirst({
        where: {
          userId: savedUser.id,
          tenantId: { not: invitation.tenantId },
          status: MembershipStatus.ACTIVE
        }
      });

      if (otherActiveMembership && !savedUser.isPlatformAdmin) {
        throw new ConflictException("This account already belongs to another tenant.");
      }

      await tx.role.upsert({
        where: {
          tenantId_userId: {
            tenantId: invitation.tenantId,
            userId: savedUser.id
          }
        },
        update: {
          name: invitation.role,
          status: MembershipStatus.ACTIVE
        },
        create: {
          tenantId: invitation.tenantId,
          userId: savedUser.id,
          name: invitation.role
        }
      });
      await tx.tenantInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: now }
      });
      await tx.auditLog.create({
        data: {
          tenantId: invitation.tenantId,
          actorUserId: savedUser.id,
          action: "membership.invitation.accepted",
          resourceType: "tenant_invitation",
          resourceId: invitation.id,
          outcome: "success"
        }
      });

      return savedUser.id;
    });

    return this.getMe({ ...auth, userId });
  }
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}
