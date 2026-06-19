import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { TenantRequest } from "../../common/tenant/tenant.types";
import type { WidgetAuthenticatedRequest } from "./widget-session.types";
import { WidgetSessionService } from "./widget-session.service";

@Injectable()
export class WidgetSessionGuard implements CanActivate {
  constructor(@Inject(WidgetSessionService) private readonly sessions: WidgetSessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<WidgetAuthenticatedRequest & TenantRequest>();

    if (!request.tenant) {
      throw new UnauthorizedException("Tenant context is required.");
    }

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

    request.widgetSession = this.sessions.verify(token, request.tenant);
    return true;
  }
}
