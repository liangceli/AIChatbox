import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { loadServerEnv } from "@platform/config";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import type { WidgetSessionContext } from "./widget-session.types";

const TOKEN_VERSION = "v1";

@Injectable()
export class WidgetSessionService {
  issue(tenant: ResolvedTenant, existingToken?: string): {
    sessionToken: string;
    visitorId: string;
    expiresAt: string;
  } {
    let visitorId: string = randomUUID();

    if (existingToken?.trim()) {
      visitorId = this.verify(existingToken, tenant).visitorId;
    }

    const env = loadServerEnv(process.env);
    const expiresAt = Math.floor(Date.now() / 1000) + env.WIDGET_SESSION_TTL_SECONDS;
    const payload = Buffer.from(JSON.stringify({ tenantId: tenant.id, visitorId, expiresAt }), "utf8").toString("base64url");
    const signature = this.sign(payload);

    return {
      sessionToken: `${TOKEN_VERSION}.${payload}.${signature}`,
      visitorId,
      expiresAt: new Date(expiresAt * 1000).toISOString()
    };
  }

  verify(token: string, tenant: ResolvedTenant): WidgetSessionContext {
    const [version, payload, signature] = token.trim().split(".");

    if (version !== TOKEN_VERSION || !payload || !signature) {
      throw new UnauthorizedException("Widget session is invalid.");
    }

    const expected = Buffer.from(this.sign(payload));
    const provided = Buffer.from(signature);

    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException("Widget session is invalid.");
    }

    try {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<WidgetSessionContext>;

      if (
        claims.tenantId !== tenant.id ||
        typeof claims.visitorId !== "string" ||
        !claims.visitorId ||
        typeof claims.expiresAt !== "number" ||
        claims.expiresAt <= Math.floor(Date.now() / 1000)
      ) {
        throw new UnauthorizedException("Widget session is invalid or expired.");
      }

      return claims as WidgetSessionContext;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Widget session is invalid.");
    }
  }

  private sign(payload: string): string {
    const env = loadServerEnv(process.env);
    const secret = env.WIDGET_SESSION_SECRET?.trim() || env.ADMIN_WEB_SESSION_SECRET?.trim();

    if (!secret || secret.length < 32) {
      throw new UnauthorizedException("Widget session protection is not configured.");
    }

    return createHmac("sha256", secret).update(`${TOKEN_VERSION}.${payload}`).digest("base64url");
  }
}
