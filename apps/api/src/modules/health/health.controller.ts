import { Controller, Get } from "@nestjs/common";
import { loadServerEnv } from "@platform/config";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    const env = loadServerEnv(process.env);

    return {
      status: "ok",
      service: "api",
      mode: "multi-tenant",
      adminApiProtectionMode: env.ADMIN_API_PROTECTION_MODE,
      aiProvider: env.AI_PROVIDER,
      clerkConfigured: Boolean(env.CLERK_JWT_KEY?.trim()),
      timestamp: new Date().toISOString()
    };
  }
}
