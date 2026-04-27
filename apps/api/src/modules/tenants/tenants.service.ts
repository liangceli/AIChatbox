import { ConversationStatus, TenantStatus } from "@platform/database";
import type { TenantOverviewRecord } from "@platform/types";
import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { CreateTenantDto } from "./dto/create-tenant.dto";

@Injectable()
export class TenantsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listTenants(): Promise<TenantOverviewRecord[]> {
    const tenants = await this.prisma.client.tenant.findMany({
      include: {
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

    return tenants.map((tenant) => ({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      status: tenant.status.toLowerCase(),
      conversationCount: tenant._count.conversations,
      pendingHumanCount: pendingByTenant.get(tenant.id) ?? 0,
      knowledgeBaseCount: tenant._count.knowledgeBases,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString()
    }));
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
          displayName: `${createdTenant.name} Support Assistant`,
          welcomeMessage: "Hi, I can help with quick support questions.",
          fallbackMessage: "I received your message and will help with the next step.",
          handoffEnabled: true,
          widgetSettings: {
            title: `${createdTenant.name} Support`
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

      if (supportEmail) {
        const user = await tx.user.upsert({
          where: {
            email: supportEmail
          },
          update: {
            name: input.name.trim()
          },
          create: {
            email: supportEmail,
            name: `${createdTenant.name} Support Admin`,
            isPlatformAdmin: false
          }
        });

        await tx.role.create({
          data: {
            tenantId: createdTenant.id,
            userId: user.id,
            name: "SUPPORT_ADMIN"
          }
        });
      }

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
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString()
    };
  }
}
