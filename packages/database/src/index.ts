import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __platformPrisma__: PrismaClient | undefined;
}

export const prisma =
  global.__platformPrisma__ ??
  new PrismaClient({
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.__platformPrisma__ = prisma;
}
