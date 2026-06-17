import { loadServerEnv, type ServerEnv } from "@platform/config";
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
    const request = context.switchToHttp().getRequest<Request & TenantRequest>();
    const token = this.resolveBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Clerk authentication token is required.");
    }

    const claims = this.verifyClerkJwt(token);
    await this.authorizeClerkClaims(request, claims);

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

    const normalizedPublicKey = normalizePem(publicKey);
    const signature = Buffer.from(encodedSignature, "base64url");

    if (!verifier.verify(createPublicKey(normalizedPublicKey), signature)) {
      throw new ForbiddenException("Clerk authentication token is invalid.");
    }

    const claims = parseBase64UrlJson(encodedPayload) as ClerkJwtClaims;
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (!claims.sub || typeof claims.sub !== "string") {
      throw new UnauthorizedException("Clerk authentication token is missing a subject.");
    }

    if (typeof claims.exp === "number" && claims.exp <= nowSeconds) {
      throw new UnauthorizedException("Clerk authentication token has expired.");
    }

    if (typeof claims.nbf === "number" && claims.nbf > nowSeconds) {
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
    request: Request & TenantRequest,
    claims: ClerkJwtClaims
  ): Promise<void> {
    if (!this.prisma) {
      throw new UnauthorizedException("Clerk tenant authorization is not configured.");
    }

    const tenantSlug = request.tenant?.slug ?? resolveTenantSlugFromRequest(request);
    const user = await this.findMappedUser(claims, tenantSlug);

    if (!user) {
      throw new ForbiddenException("Clerk user is not mapped to this tenant.");
    }

    if (!tenantSlug && !user.isPlatformAdmin) {
      throw new ForbiddenException("Platform admin access is required.");
    }
  }

  private async findMappedUser(claims: ClerkJwtClaims, tenantSlug?: string) {
    const email = resolveClaimEmail(claims);

    if (tenantSlug) {
      const roles = await this.prisma!.client.role.findMany({
        where: {
          tenant: {
            slug: tenantSlug
          }
        },
        include: {
          user: true
        }
      });

      return roles
        .map((role) => role.user)
        .find((user) => isUserMappedToClerk(user, claims.sub, email));
    }

    const users = await this.prisma!.client.user.findMany();

    return users.find((user) => isUserMappedToClerk(user, claims.sub, email));
  }
}

type ClerkJwtClaims = {
  sub?: unknown;
  exp?: unknown;
  nbf?: unknown;
  iss?: unknown;
  azp?: unknown;
  email?: unknown;
  primary_email?: unknown;
};

type MappedUser = {
  email: string;
  isPlatformAdmin: boolean;
  metadata?: unknown;
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

function isUserMappedToClerk(user: MappedUser, clerkSubject: unknown, email?: string): boolean {
  const normalizedEmail = email?.toLowerCase();

  if (normalizedEmail && user.email.toLowerCase() === normalizedEmail) {
    return true;
  }

  if (!clerkSubject || typeof clerkSubject !== "string") {
    return false;
  }

  const metadata = user.metadata as Record<string, unknown> | null | undefined;

  return (
    metadata?.clerkUserId === clerkSubject ||
    metadata?.clerkSubject === clerkSubject ||
    metadata?.clerk_user_id === clerkSubject
  );
}
