import { createParamDecorator, ExecutionContext, InternalServerErrorException } from "@nestjs/common";
import type { ResolvedTenant, TenantRequest } from "./tenant.types";

export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ResolvedTenant => {
    const request = context.switchToHttp().getRequest<TenantRequest>();

    if (!request.tenant) {
      throw new InternalServerErrorException("Tenant context was not resolved for this request.");
    }

    return request.tenant;
  }
);
