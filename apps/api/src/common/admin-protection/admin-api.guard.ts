import { loadServerEnv, type ServerEnv } from "@platform/config";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

const ADMIN_TOKEN_HEADER = "x-admin-api-token";

@Injectable()
export class AdminApiGuard implements CanActivate {
  private env: ServerEnv;

  constructor() {
    this.env = loadServerEnv(process.env);
  }

  static createForTest(env: ServerEnv): AdminApiGuard {
    const guard = new AdminApiGuard();
    guard.env = env;

    return guard;
  }

  canActivate(context: ExecutionContext): boolean {
    if (this.env.ADMIN_API_PROTECTION_MODE === "disabled") {
      return true;
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

  private isTokenValid(providedToken: string, expectedToken: string): boolean {
    const provided = Buffer.from(providedToken);
    const expected = Buffer.from(expectedToken);

    if (provided.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(provided, expected);
  }
}
