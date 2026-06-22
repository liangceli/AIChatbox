import "reflect-metadata";
import "./load-env";
import { loadServerEnv } from "@platform/config";
import { prisma } from "@platform/database";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { createTenantResolutionMiddleware } from "./common/tenant/tenant-resolution.middleware";
import { AppModule } from "./app.module";

async function bootstrap() {
  const env = loadServerEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: buildCorsOptions(env.CORS_ALLOWED_ORIGINS),
    bodyParser: false
  });

  app.useBodyParser("json", { limit: "2mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "2mb" });
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/v1/widget/session", createRateLimitMiddleware(30, 60_000));
  app.use("/v1/chat/messages", createRateLimitMiddleware(20, 60_000));
  app.use("/v1/account/accept-invitation", createRateLimitMiddleware(10, 60_000));
  app.use("/v1/account/me/avatar", createRateLimitMiddleware(10, 60_000));
  app.use("/v1/members/invitations", createRateLimitMiddleware(30, 60_000));
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true //移除DTO中没有定义的字段
    })
  );
  app.use(
    [
      "/v1/chat",
      "/v1/conversations",
      "/v1/knowledge-bases",
      "/v1/members",
      "/v1/realtime",
      "/v1/search",
      "/v1/tenant-profile"
      ,"/v1/widget"
    ],
    createTenantResolutionMiddleware(prisma) //只有这些routes才会进入tenant解析逻辑
  );

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/v1`, "Bootstrap");
}

function createRateLimitMiddleware(limit: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${request.ip || request.socket.remoteAddress || "unknown"}:${request.method}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= limit) {
      response.setHeader("Retry-After", Math.max(1, Math.ceil((current.resetAt - now) / 1000)).toString());
      response.status(429).json({ message: "Too many requests." });
      return;
    }

    current.count += 1;
    next();
  };
}

bootstrap();

function buildCorsOptions(allowedOrigins?: string) {
  const origins = allowedOrigins
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins || origins.length === 0) {
    return true;
  }

  return {
    origin: origins,
    credentials: true
  };
}
