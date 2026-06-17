import "reflect-metadata";
import "./load-env";
import { loadServerEnv } from "@platform/config";
import { prisma } from "@platform/database";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
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
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true //移除DTO中没有定义的字段
    })
  );
  app.use(
    ["/v1/chat", "/v1/conversations", "/v1/knowledge-bases", "/v1/realtime", "/v1/tenant-profile"],
    createTenantResolutionMiddleware(prisma) //只有这些routes才会进入tenant解析逻辑
  );

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/v1`, "Bootstrap");
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
