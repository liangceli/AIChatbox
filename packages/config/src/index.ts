import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z
      .string()
      .min(1)
      .default("postgresql://postgres:postgres@localhost:5432/ai_support_platform"),
    REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
    API_PORT: z.coerce.number().int().positive().default(4000),
    NEXT_PUBLIC_API_BASE_URL: z.string().min(1).default("http://localhost:4000/v1"),
    CORS_ALLOWED_ORIGINS: z.string().optional(),
    NEXT_PUBLIC_DEFAULT_TENANT_SLUG: z.string().min(1).default("demo"),
    WIDGET_DEFAULT_TENANT_SLUG: z.string().min(1).default("demo"),
    AI_PROVIDER: z.enum(["deterministic", "openai"]).default("deterministic"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().optional(),
    OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),
    OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    ADMIN_API_PROTECTION_MODE: z.enum(["token", "clerk", "disabled"]).default("token"),
    ADMIN_API_TOKEN: z.string().optional(),
    CLERK_JWT_KEY: z.string().optional(),
    CLERK_ISSUER: z.string().optional(),
    CLERK_AUTHORIZED_PARTIES: z.string().optional(),
    API_INTERNAL_BASE_URL: z.string().min(1).default("http://localhost:4000/v1"),
    ADMIN_WEB_ACCESS_TOKEN: z.string().optional(),
    ADMIN_WEB_SESSION_COOKIE_NAME: z.string().min(1).default("platform_admin_session"),
    ADMIN_WEB_SESSION_SECRET: z.string().optional(),
    ADMIN_WEB_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(43200),
    KNOWLEDGE_IMPORT_USER_AGENT: z
      .string()
      .min(1)
      .default("PlatformKnowledgeImporter/0.1 knowledge-import"),
    ALLOW_UNPROTECTED_ADMIN_API_IN_DEV: z.preprocess(
      (value) => value === true || value === "true",
      z.boolean()
    ).default(false)
  })
  .superRefine((env, context) => {
    if (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai."
      });
    }

    if (env.AI_PROVIDER === "openai" && !env.OPENAI_MODEL?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_MODEL"],
        message: "OPENAI_MODEL is required when AI_PROVIDER=openai."
      });
    }

    if (env.ADMIN_API_PROTECTION_MODE === "disabled") {
      if (env.NODE_ENV === "production") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ADMIN_API_PROTECTION_MODE"],
          message: "ADMIN_API_PROTECTION_MODE=disabled is not allowed in production."
        });
      }

      if (!env.ALLOW_UNPROTECTED_ADMIN_API_IN_DEV) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ALLOW_UNPROTECTED_ADMIN_API_IN_DEV"],
          message:
            "ALLOW_UNPROTECTED_ADMIN_API_IN_DEV=true is required when ADMIN_API_PROTECTION_MODE=disabled."
        });
      }
    }

    if (env.ADMIN_API_PROTECTION_MODE === "clerk" && !env.CLERK_JWT_KEY?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLERK_JWT_KEY"],
        message: "CLERK_JWT_KEY is required when ADMIN_API_PROTECTION_MODE=clerk."
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const adminWebEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_INTERNAL_BASE_URL: z.string().min(1).default("http://localhost:4000/v1"),
  ADMIN_API_TOKEN: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_JWT_KEY: z.string().optional(),
  CLERK_ISSUER: z.string().optional(),
  CLERK_AUTHORIZED_PARTIES: z.string().optional(),
  CLERK_SIGN_IN_URL: z.string().min(1).default("/sign-in"),
  CLERK_SIGN_UP_URL: z.string().min(1).default("/sign-up"),
  CLERK_AFTER_SIGN_IN_URL: z.string().min(1).default("/admin"),
  CLERK_AFTER_SIGN_UP_URL: z.string().min(1).default("/admin"),
  ADMIN_WEB_CLERK_SESSION_COOKIE_NAME: z.string().min(1).default("platform_clerk_session"),
  ADMIN_WEB_ACCESS_TOKEN: z.string().optional(),
  ADMIN_WEB_SESSION_COOKIE_NAME: z.string().min(1).default("platform_admin_session"),
  ADMIN_WEB_SESSION_SECRET: z.string().optional(),
  ADMIN_WEB_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(43200)
});

export type AdminWebEnv = z.infer<typeof adminWebEnvSchema>;

export function loadWorkspaceEnv(cwd = process.cwd()): void {
  const candidates = [resolve(cwd, ".env"), resolve(cwd, "../../.env")];

  for (const path of candidates) {
    if (existsSync(path)) {
      dotenv.config({
        path,
        override: false
      });
    }
  }
}

export function loadServerEnv(source: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(source);
}

export function loadAdminWebEnv(source: Record<string, string | undefined>): AdminWebEnv {
  return adminWebEnvSchema.parse(source);
}
