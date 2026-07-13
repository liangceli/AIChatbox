import { TenantStatus } from "@platform/database";
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { TenantRequest } from "../../common/tenant/tenant.types";
import { toResolvedTenant } from "../../common/tenant/tenant.types";
import type { WidgetAuthenticatedRequest } from "./widget-session.types";
import { WidgetSessionService } from "./widget-session.service";

@Injectable()
export class WidgetSessionGuard implements CanActivate {
  constructor(
    @Inject(WidgetSessionService) private readonly sessions: WidgetSessionService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WidgetAuthenticatedRequest & TenantRequest>();

    const header = request.headers["x-widget-session"];
    const query = request.query.widgetSession;
    const token = typeof header === "string"
      ? header
      : Array.isArray(header)
        ? header[0]
        : typeof query === "string"
          ? query
          : undefined;

    if (!token) {
      throw new UnauthorizedException("Widget session is required.");
    }

    const session = this.sessions.verify(token);
    const tenant = await this.prisma.client.tenant.findFirst({
      where: {
        id: session.tenantId,
        status: TenantStatus.ACTIVE
      },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true
      }
    });

    if (!tenant) {
      throw new UnauthorizedException("Widget session tenant is unavailable.");
    }

    const requestedTenantSlug = readRequestedTenantSlug(request);

    if (requestedTenantSlug && requestedTenantSlug !== tenant.slug) {
      throw new UnauthorizedException("Widget session does not match the requested tenant.");
    }

    request.tenant = toResolvedTenant(tenant);
    request.widgetSession = session;
    return true;
  }
}

function readRequestedTenantSlug(request: TenantRequest): string | undefined {
  const header = request.headers["x-tenant-slug"];
  const query = request.query.tenantSlug;
  const value = Array.isArray(header)
    ? header[0]
    : header ?? (Array.isArray(query) ? query[0] : query);

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
