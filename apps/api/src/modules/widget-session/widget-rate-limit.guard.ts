import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { TenantRequest } from "../../common/tenant/tenant.types";
import type { WidgetAuthenticatedRequest } from "./widget-session.types";

const WINDOW_MS = 60_000;
const VISITOR_LIMIT = 20;
const TENANT_LIMIT = 300;

@Injectable()
export class WidgetRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      WidgetAuthenticatedRequest & TenantRequest & { body?: { conversationId?: string } }
    >();

    if (!request.widgetSession || !request.tenant) {
      throw new HttpException("Widget session is required.", HttpStatus.UNAUTHORIZED);
    }

    const conversationId = request.body?.conversationId?.trim() || "new";
    const visitorKey = `visitor:${request.tenant.id}:${request.widgetSession.visitorId}:${conversationId}`;
    const tenantKey = `tenant:${request.tenant.id}`;

    this.consume(visitorKey, VISITOR_LIMIT);
    this.consume(tenantKey, TENANT_LIMIT);
    this.pruneExpiredBuckets();
    return true;
  }

  private consume(key: string, limit: number): void {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return;
    }

    if (current.count >= limit) {
      throw new HttpException(
        {
          message: "Too many widget requests.",
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    current.count += 1;
  }

  private pruneExpiredBuckets(): void {
    if (this.buckets.size < 2_000) {
      return;
    }

    const now = Date.now();

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
