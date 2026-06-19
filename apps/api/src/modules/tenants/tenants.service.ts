import { ConversationStatus, MembershipStatus, Prisma, TenantRole, TenantStatus } from "@platform/database";
import type { PublicTenantAiProfile, TenantAiProfile, TenantOverviewRecord } from "@platform/types";
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import type { CreateTenantDto } from "./dto/create-tenant.dto";
import type { UpdateTenantAiProfileDto } from "./dto/update-tenant-ai-profile.dto";
import {
  buildAgentConfigPersistence,
  buildTenantAiProfile,
  mergeTenantAiProfile,
  toPublicTenantAiProfile
} from "./tenant-ai-profile";

@Injectable()
export class TenantsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listTenants(): Promise<TenantOverviewRecord[]> {
    const tenants = await this.prisma.client.tenant.findMany({
      include: {
        roles: {
          select: { name: true, status: true }
        },
        _count: {
          select: {
            conversations: true,
            knowledgeBases: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const pendingCounts = await this.prisma.client.conversation.groupBy({
      by: ["tenantId"],
      where: {
        status: ConversationStatus.PENDING_HUMAN
      },
      _count: {
        _all: true
      }
    });
    const pendingByTenant = new Map(
      pendingCounts.map((count) => [count.tenantId, count._count._all])
    );

    const now = new Date();
    const activeInvitationCounts = await this.prisma.client.tenantInvitation.groupBy({
      by: ["tenantId"],
      where: {
        role: TenantRole.AGENT,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      _count: { _all: true }
    });
    const activeInvitationsByTenant = new Map(
      activeInvitationCounts.map((count) => [count.tenantId, count._count._all])
    );

    return tenants.map((tenant) => toTenantOverview(
      tenant,
      pendingByTenant.get(tenant.id) ?? 0,
      activeInvitationsByTenant.get(tenant.id) ?? 0
    ));
  }

  async updateAgentInvitationQuota(
    tenantSlug: string,
    quota: number,
    actorUserId?: string
  ): Promise<TenantOverviewRecord> {
    if (!actorUserId) {
      throw new ForbiddenException("A mapped platform administrator is required.");
    }

    const normalizedSlug = tenantSlug.trim().toLowerCase();
    const existingTenant = await this.prisma.client.tenant.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true }
    });

    if (!existingTenant) {
      throw new NotFoundException(`Tenant not found for slug: ${tenantSlug}`);
    }

    const tenant = await this.prisma.client.$transaction(async (tx) => {
      const updatedTenant = await tx.tenant.update({
        where: { slug: normalizedSlug },
        data: { agentInvitationQuota: quota },
        include: {
          roles: { select: { name: true, status: true } },
          _count: { select: { conversations: true, knowledgeBases: true } }
        }
      });
      await tx.auditLog.create({
        data: {
          tenantId: updatedTenant.id,
          actorUserId,
          action: "tenant.agent_invitation_quota.changed",
          resourceType: "tenant",
          resourceId: updatedTenant.id,
          outcome: "success",
          metadata: { quota }
        }
      });
      return updatedTenant;
    });

    const [pendingHumanCount, activeAgentInvitationCount] = await Promise.all([
      this.prisma.client.conversation.count({
        where: { tenantId: tenant.id, status: ConversationStatus.PENDING_HUMAN }
      }),
      this.prisma.client.tenantInvitation.count({
        where: {
          tenantId: tenant.id,
          role: TenantRole.AGENT,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() }
        }
      })
    ]);

    return toTenantOverview(tenant, pendingHumanCount, activeAgentInvitationCount);
  }

  async createTenant(input: CreateTenantDto): Promise<TenantOverviewRecord> {
    const slug = input.slug.trim().toLowerCase();
    const supportEmail = input.supportEmail?.trim().toLowerCase();

    const existing = await this.prisma.client.tenant.findUnique({
      where: {
        slug
      },
      select: {
        id: true
      }
    });

    if (existing) {
      throw new ConflictException(`Tenant slug already exists: ${slug}`);
    }

    const tenant = await this.prisma.client.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          slug,
          name: input.name.trim(),
          status: TenantStatus.ACTIVE,
          defaultLocale: input.defaultLocale?.trim() || null,
          branding: {
            name: input.name.trim(),
            supportEmail: supportEmail ?? null
          }
        }
      });

      await tx.agentConfig.create({
        data: {
          tenantId: createdTenant.id,
          displayName: "AI Support Assistant",
          welcomeMessage: "Hi, how can I help today?",
          fallbackMessage:
            "I do not have enough confirmed information to answer that. I can connect you with the team for help.",
          handoffEnabled: true,
          widgetSettings: {
            title: "AI Support Assistant",
            companyDisplayName: createdTenant.name,
            welcomeMessage: "Hi, how can I help today?",
            fallbackMessage:
              "I do not have enough confirmed information to answer that. I can connect you with the team for help.",
            handoffMessage: "I can pass this to a team member for support."
          },
          metadata: {
            aiProfile: {
              assistantName: "AI Support Assistant",
              companyDisplayName: createdTenant.name,
              businessType: "customer support",
              tone: "helpful, concise, professional",
              handoffMessage: "I can pass this to a team member for support.",
              safeAnswerInstructions:
                "Use confirmed support knowledge and safe general guidance. If information is missing, say that clearly.",
              sensitiveTopicInstructions:
                "For sensitive or uncertain topics, avoid guessing and recommend human support when appropriate.",
              doNotAnswerInstructions:
                "Do not answer with unsupported prices, policies, guarantees, private data, credentials, or internal system details.",
              primaryColor: null,
              logoUrl: null,
              avatarUrl: null
            }
          }
        }
      });

      await tx.knowledgeBase.create({
        data: {
          tenantId: createdTenant.id,
          slug: "default",
          name: "Default Knowledge Base",
          description: "Default tenant-scoped knowledge base."
        }
      });

      return createdTenant;
    });

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status.toLowerCase(),
      conversationCount: 0,
      pendingHumanCount: 0,
      knowledgeBaseCount: 1,
      ownerCount: 0,
      agentCount: 0,
      suspendedMemberCount: 0,
      activeAgentInvitationCount: 0,
      agentInvitationQuota: tenant.agentInvitationQuota,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString()
    };
  }

  async getTenantAiProfile(tenantSlug: string): Promise<TenantAiProfile> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: {
        slug: tenantSlug.trim()
      },
      include: {
        agentConfig: true
      }
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found for slug: ${tenantSlug}`);
    }

    return buildTenantAiProfile(tenant, tenant.agentConfig);
  }

  async updateTenantAiProfile(
    tenantSlug: string,
    input: UpdateTenantAiProfileDto
  ): Promise<TenantAiProfile> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: {
        slug: tenantSlug.trim()
      },
      include: {
        agentConfig: true
      }
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found for slug: ${tenantSlug}`);
    }

    const currentProfile = buildTenantAiProfile(tenant, tenant.agentConfig);
    const nextProfile = mergeTenantAiProfile(currentProfile, input);
    const persistence = buildAgentConfigPersistence(nextProfile, tenant.agentConfig);

    await this.prisma.client.agentConfig.upsert({
      where: {
        tenantId: tenant.id
      },
      update: {
        displayName: persistence.displayName,
        welcomeMessage: persistence.welcomeMessage,
        fallbackMessage: persistence.fallbackMessage,
        widgetSettings: persistence.widgetSettings as Prisma.InputJsonValue,
        metadata: persistence.metadata as Prisma.InputJsonValue
      },
      create: {
        tenantId: tenant.id,
        displayName: persistence.displayName,
        welcomeMessage: persistence.welcomeMessage,
        fallbackMessage: persistence.fallbackMessage,
        handoffEnabled: true,
        widgetSettings: persistence.widgetSettings as Prisma.InputJsonValue,
        metadata: persistence.metadata as Prisma.InputJsonValue
      }
    });

    return nextProfile;
  }

  async getPublicTenantAiProfile(tenant: ResolvedTenant): Promise<PublicTenantAiProfile> {
    const record = await this.prisma.client.tenant.findUnique({
      where: {
        id: tenant.id
      },
      include: {
        agentConfig: true
      }
    });

    if (!record) {
      throw new NotFoundException(`Tenant not found for slug: ${tenant.slug}`);
    }

    return toPublicTenantAiProfile(buildTenantAiProfile(record, record.agentConfig));
  }
}

type TenantOverviewSource = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  agentInvitationQuota: number;
  createdAt: Date;
  updatedAt: Date;
  roles: Array<{ name: TenantRole; status: MembershipStatus }>;
  _count: { conversations: number; knowledgeBases: number };
};

function toTenantOverview(
  tenant: TenantOverviewSource,
  pendingHumanCount: number,
  activeAgentInvitationCount: number
): TenantOverviewRecord {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status.toLowerCase(),
    conversationCount: tenant._count.conversations,
    pendingHumanCount,
    knowledgeBaseCount: tenant._count.knowledgeBases,
    ownerCount: tenant.roles.filter((role) => role.name === TenantRole.OWNER && role.status === MembershipStatus.ACTIVE).length,
    agentCount: tenant.roles.filter((role) => role.name === TenantRole.AGENT && role.status === MembershipStatus.ACTIVE).length,
    suspendedMemberCount: tenant.roles.filter((role) => role.status === MembershipStatus.SUSPENDED).length,
    activeAgentInvitationCount,
    agentInvitationQuota: tenant.agentInvitationQuota,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString()
  };
}
