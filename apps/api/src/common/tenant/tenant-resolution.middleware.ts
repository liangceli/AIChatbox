import { BadRequestException, NotFoundException } from "@nestjs/common";
import { TenantStatus, type PrismaClient } from "@platform/database";
import type { NextFunction, Response } from "express";
import type { TenantRequest } from "./tenant.types";
import { toResolvedTenant } from "./tenant.types";

//解析tenant的文件

// 请求里面要带这个header
const TENANT_HEADER_NAME = "x-tenant-slug";

export function createTenantResolutionMiddleware(prisma: PrismaClient) {
  return async function tenantResolutionMiddleware(
    request: TenantRequest,
    _response: Response,
    next: NextFunction
  ) {
    try {
      if (request.method === "OPTIONS") { //如果是option请求 直接放行
        next();
        return;
      }

      const headerValue = request.headers[TENANT_HEADER_NAME];
      const tenantQueryValue = request.query.tenantSlug;
      const rawTenantSlug = Array.isArray(headerValue)
        ? headerValue[0]
        : headerValue ||
          (Array.isArray(tenantQueryValue) ? tenantQueryValue[0] : tenantQueryValue);
      const tenantSlug = typeof rawTenantSlug === "string" ? rawTenantSlug : undefined;

      if (!tenantSlug || !tenantSlug.trim()) {
        next(new BadRequestException(`Missing required tenant header: ${TENANT_HEADER_NAME}`));
        return;
      }

      const tenant = await prisma.tenant.findFirst({
        where: {
          slug: tenantSlug.trim(),
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
        next(new NotFoundException("Tenant not found."));
        return;
      }

      request.tenant = toResolvedTenant(tenant);
      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}
