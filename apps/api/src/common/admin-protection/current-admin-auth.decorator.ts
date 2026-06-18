import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AdminAuthContext, AdminAuthenticatedRequest } from "./admin-auth-context";

export const CurrentAdminAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminAuthContext | undefined => {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();

    return request.adminAuth;
  }
);
