import { loadServerEnv, type ServerEnv } from "@platform/config";
import { MembershipStatus, TenantStatus } from "@platform/database";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { createPublicKey, createVerify, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { TenantRequest } from "../tenant/tenant.types";
import type { AdminAuthenticatedRequest } from "./admin-auth-context";
import { ACCESS_POLICY_KEY, type AccessPolicy } from "./access-policy.decorator";

const ADMIN_TOKEN_HEADER = "x-admin-api-token";

@Injectable()
export class AdminApiGuard implements CanActivate {
  private env: ServerEnv;

  constructor(@Inject(PrismaService) private readonly prisma?: PrismaService) {
    this.env = loadServerEnv(process.env);
  }

  static createForTest(env: ServerEnv, prisma?: PrismaService): AdminApiGuard {
    const guard = new AdminApiGuard(prisma);
    guard.env = env;

    return guard;
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    if (this.env.ADMIN_API_PROTECTION_MODE === "disabled") {
      return true;
    }

    if (this.env.ADMIN_API_PROTECTION_MODE === "clerk") {
      return this.canActivateWithClerk(context);
    }

    const expectedToken = this.env.ADMIN_API_TOKEN?.trim();

    if (!expectedToken) {
      throw new UnauthorizedException("Admin API protection is not configured.");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedToken = this.resolveToken(request);

    if (!providedToken) {
      throw new UnauthorizedException("Admin API protection token is required.");
    }

    if (!this.isTokenValid(providedToken, expectedToken)) {
      throw new ForbiddenException("Admin API protection token is invalid.");
    }

    return true;
  }

  private async canActivateWithClerk(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest & TenantRequest>();
    const token = this.resolveBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Clerk authentication token is required.");
    }

    const claims = this.verifyClerkJwt(token);
    await this.authorizeClerkClaims(request, claims, resolveAccessPolicy(context));

    return true;
  }

  private resolveToken(request: Request): string | undefined {
    const headerValue = request.headers[ADMIN_TOKEN_HEADER];
    const tokenFromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (typeof tokenFromHeader === "string" && tokenFromHeader.trim()) {
      return tokenFromHeader.trim();
    }

    const authorization = request.headers.authorization;

    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      return authorization.slice("Bearer ".length).trim();
    }

    return undefined;
  }

  private resolveBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      return authorization.slice("Bearer ".length).trim();
    }

    return undefined;
  }

  private isTokenValid(providedToken: string, expectedToken: string): boolean {
    const provided = Buffer.from(providedToken);
    const expected = Buffer.from(expectedToken);

    if (provided.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(provided, expected);
  }

  private verifyClerkJwt(token: string): ClerkJwtClaims {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException("Clerk authentication token is malformed.");
    }

    const header = parseBase64UrlJson(encodedHeader) as { alg?: unknown };

    if (header.alg !== "RS256") {
      throw new UnauthorizedException("Clerk authentication token algorithm is unsupported.");
    }

    const publicKey = this.env.CLERK_JWT_KEY?.trim();

    if (!publicKey) {
      throw new UnauthorizedException("Clerk authentication is not configured.");
    }

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();

    try {
      const normalizedPublicKey = normalizePem(publicKey);
      const signature = Buffer.from(encodedSignature, "base64url");

      if (!verifier.verify(createPublicKey(normalizedPublicKey), signature)) {
        throw new ForbiddenException("Clerk authentication token is invalid.");
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new UnauthorizedException("Clerk authentication is not configured.");
    }

    const claims = parseBase64UrlJson(encodedPayload) as ClerkJwtClaims;
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (!claims.sub || typeof claims.sub !== "string") {
      throw new UnauthorizedException("Clerk authentication token is missing a subject.");
    }

    if (typeof claims.exp !== "number" || claims.exp + this.env.CLERK_CLOCK_SKEW_SECONDS <= nowSeconds) {
      throw new UnauthorizedException("Clerk authentication token has expired.");
    }

    if (
      claims.nbf !== undefined &&
      (typeof claims.nbf !== "number" || claims.nbf - this.env.CLERK_CLOCK_SKEW_SECONDS > nowSeconds)
    ) {
      throw new UnauthorizedException("Clerk authentication token is not active yet.");
    }

    if (this.env.CLERK_ISSUER?.trim() && claims.iss !== this.env.CLERK_ISSUER.trim()) {
      throw new ForbiddenException("Clerk authentication token issuer is invalid.");
    }

    const authorizedParties = parseCsv(this.env.CLERK_AUTHORIZED_PARTIES);

    if (authorizedParties.length > 0) {
      const azp = typeof claims.azp === "string" ? claims.azp : undefined;

      if (!azp || !authorizedParties.includes(azp)) {
        throw new ForbiddenException("Clerk authentication token authorized party is invalid.");
      }
    }

    return claims;
  }

  private async authorizeClerkClaims(
    request: AdminAuthenticatedRequest & TenantRequest,
    claims: ClerkJwtClaims,
    policy: AccessPolicy
  ): Promise<void> {
    if (!this.prisma) {
      throw new UnauthorizedException("Clerk tenant authorization is not configured.");
    }

    const tenantSlug = request.tenant?.slug ?? resolveTenantSlugFromRequest(request);
    const mappedUser = await this.findMappedUser(claims, tenantSlug);

    if (!mappedUser) {
      if (policy.allowUnmapped) {
        request.adminAuth = {
          email: resolveClaimEmail(claims),
          clerkSubject: claims.sub,
          isPlatformAdmin: false,
          tenantSlug
        };
        return;
      }

      throw new ForbiddenException("Clerk user is not mapped to this tenant.");
    }

    if (policy.platformOnly && !mappedUser.user.isPlatformAdmin) {
      throw new ForbiddenException("Platform admin access is required.");
    }

    if (tenantSlug && !mappedUser.user.isPlatformAdmin) {
      if (!mappedUser.role || mappedUser.role.status !== MembershipStatus.ACTIVE) {
        throw new ForbiddenException("Active tenant membership is required.");
      }

      if (policy.tenantRoles?.length && !policy.tenantRoles.includes(mappedUser.role.name)) {
        throw new ForbiddenException("Tenant role is not permitted for this operation.");
      }
    }

    if (!tenantSlug && !policy.allowUnmapped && !mappedUser.user.isPlatformAdmin) {
      throw new ForbiddenException("Platform admin access is required.");
    }

    request.adminAuth = {
      userId: mappedUser.user.id,
      email: mappedUser.user.email,
      clerkSubject: claims.sub,
      isPlatformAdmin: mappedUser.user.isPlatformAdmin,
      tenantId: mappedUser.role?.tenantId,
      tenantSlug,
      roleName: mappedUser.role?.name ?? null,
      membershipStatus: mappedUser.role?.status ?? null
    };
  }

  private async findMappedUser(claims: ClerkJwtClaims, tenantSlug?: string) {
    const email = resolveClaimEmail(claims);
    const user = await this.prisma!.client.user.findFirst({
      where: {
        OR: [
          { clerkUserId: claims.sub },
          ...(email ? [{ email, clerkUserId: null }] : []),
          { metadata: { path: ["clerkUserId"], equals: claims.sub } },
          { metadata: { path: ["clerkSubject"], equals: claims.sub } },
          { metadata: { path: ["clerk_user_id"], equals: claims.sub } }
        ]
      }
    });

    if (!user) {
      return undefined;
    }

    const role = tenantSlug
      ? await this.prisma!.client.role.findFirst({
          where: {
            userId: user.id,
            tenant: { slug: tenantSlug, status: TenantStatus.ACTIVE }
          }
        })
      : null;

    if (tenantSlug && !role && !user.isPlatformAdmin) {
      return undefined;
    }

    return { user, role };
  }
}

type ClerkJwtClaims = {
  sub: string;
  exp?: unknown;
  nbf?: unknown;
  iss?: unknown;
  azp?: unknown;
  email?: unknown;
  primary_email?: unknown;
};

function parseBase64UrlJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new UnauthorizedException("Clerk authentication token is malformed.");
  }
}

function normalizePem(value: string): string {
  return value.includes("BEGIN PUBLIC KEY")
    ? value.replace(/\\n/g, "\n")
    : `-----BEGIN PUBLIC KEY-----\n${value.replace(/\s+/g, "")}\n-----END PUBLIC KEY-----`;
}

function parseCsv(value?: string): string[] {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function resolveClaimEmail(claims: ClerkJwtClaims): string | undefined {
  const candidate = typeof claims.email === "string"
    ? claims.email
    : typeof claims.primary_email === "string"
      ? claims.primary_email
      : undefined;

  return candidate?.trim().toLowerCase();
}

function resolveTenantSlugFromRequest(request: Request): string | undefined {
  const params = request.params as Record<string, string | undefined> | undefined;
  const tenantSlug = params?.tenantSlug;

  return tenantSlug?.trim() || undefined;
}

function resolveAccessPolicy(context: ExecutionContext): AccessPolicy {
  const handler = typeof context.getHandler === "function" ? context.getHandler() : undefined;
  const controller = typeof context.getClass === "function" ? context.getClass() : undefined;
  const handlerPolicy = handler
    ? Reflect.getMetadata(ACCESS_POLICY_KEY, handler) as AccessPolicy | undefined
    : undefined;
  const classPolicy = controller
    ? Reflect.getMetadata(ACCESS_POLICY_KEY, controller) as AccessPolicy | undefined
    : undefined;

  return handlerPolicy ?? classPolicy ?? {};
}
