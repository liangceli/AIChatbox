import "reflect-metadata";
import "./load-env";
import { prisma } from "@platform/database";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createTenantResolutionMiddleware } from "./common/tenant/tenant-resolution.middleware";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true
  });

  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true
    })
  );
  app.use(
    ["/v1/chat", "/v1/conversations", "/v1/knowledge-bases", "/v1/realtime"],
    createTenantResolutionMiddleware(prisma)
  );

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/v1`, "Bootstrap");
}

bootstrap();
