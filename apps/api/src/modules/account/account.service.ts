import { createHash } from "node:crypto";
import { MembershipStatus } from "@platform/database";
import type { AccountRecord } from "@platform/types";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminAuthContext } from "../../common/admin-protection/admin-auth-context";
import { PrismaService } from "../../common/prisma/prisma.service";
import { humanSupportStatusWhere } from "../conversations/conversation-status";

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
        status: humanSupportStatusWhere()
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
      avatarUrl: readAvatarUrl(user.metadata),
      isPlatformAdmin: user.isPlatformAdmin,
      memberships,
      defaultRoute
    };
  }

  async updateAvatar(auth: AdminAuthContext, avatarDataUrl: string): Promise<AccountRecord> {
    if (!auth.userId) {
      throw new ForbiddenException("A mapped account is required to update an avatar.");
    }

    validateAvatarDataUrl(avatarDataUrl);

    await this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: auth.userId } });

      if (!user) {
        throw new NotFoundException("Account mapping no longer exists.");
      }

      const metadata = isPlainObject(user.metadata) ? user.metadata : {};
      await tx.user.update({
        where: { id: user.id },
        data: { metadata: { ...metadata, avatarUrl: avatarDataUrl } }
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "account.avatar.updated",
          resourceType: "user",
          resourceId: user.id,
          outcome: "success"
        }
      });
    });

    return this.getMe(auth);
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

      const authenticatedEmail = auth.email?.trim().toLowerCase();

      if (!authenticatedEmail || authenticatedEmail !== invitation.email.toLowerCase()) {
        throw new ForbiddenException("Invitation was issued for a different Clerk email address.");
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

const maximumAvatarBytes = 512 * 1024;

export function validateAvatarDataUrl(value: string): void {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);

  if (!match) {
    throw new BadRequestException("Avatar must be a PNG, JPEG, or WebP image.");
  }

  const bytes = Buffer.from(match[2] ?? "", "base64");

  if (bytes.length === 0 || bytes.length > maximumAvatarBytes) {
    throw new BadRequestException("Avatar must be no larger than 512 KB after cropping.");
  }

  const type = match[1];
  const isPng = type === "png" && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = type === "jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = type === "webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";

  if (!isPng && !isJpeg && !isWebp) {
    throw new BadRequestException("Avatar image signature does not match its declared format.");
  }
}

function readAvatarUrl(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return null;
  }

  return typeof value.avatarUrl === "string" ? value.avatarUrl : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}
