import { z } from "zod";

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/ai_support_platform"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  NEXT_PUBLIC_API_BASE_URL: z.string().min(1).default("http://localhost:4000/v1"),
  NEXT_PUBLIC_DEFAULT_TENANT_SLUG: z.string().min(1).default("demo"),
  WIDGET_DEFAULT_TENANT_SLUG: z.string().min(1).default("demo"),
  OPENAI_API_KEY: z.string().optional()
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(source: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(source);
}
