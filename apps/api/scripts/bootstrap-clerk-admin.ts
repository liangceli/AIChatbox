import "../src/load-env";
import { prisma, TenantRole } from "@platform/database";

const tenantSlug = requiredEnv("CLERK_BOOTSTRAP_TENANT_SLUG");
const email = requiredEnv("CLERK_BOOTSTRAP_EMAIL").toLowerCase();
const clerkUserId = requiredEnv("CLERK_BOOTSTRAP_USER_ID");
const roleName = parseRole(process.env.CLERK_BOOTSTRAP_ROLE);
const displayName = process.env.CLERK_BOOTSTRAP_NAME?.trim() || null;
const isPlatformAdmin = process.env.CLERK_BOOTSTRAP_PLATFORM_ADMIN === "true";

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: {
      slug: tenantSlug
    },
    select: {
      id: true,
      slug: true
    }
  });

  if (!tenant) {
    throw new Error(`Tenant not found for CLERK_BOOTSTRAP_TENANT_SLUG=${tenantSlug}`);
  }

  const user = await prisma.user.upsert({
    where: {
      email
    },
    update: {
      name: displayName ?? undefined,
      isPlatformAdmin,
      clerkUserId,
      metadata: {
        clerkUserId
      }
    },
    create: {
      email,
      name: displayName,
      isPlatformAdmin,
      clerkUserId,
      metadata: {
        clerkUserId
      }
    },
    select: {
      id: true,
      email: true
    }
  });

  await prisma.role.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id
      }
    },
    update: {
      name: roleName
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      name: roleName
    }
  });

  console.log(`Mapped Clerk user ${user.email} to tenant ${tenant.slug} as ${roleName}.`);
}

function parseRole(value?: string): TenantRole {
  const normalized = value?.trim().toUpperCase();

  if (!normalized || normalized === "ADMIN" || normalized === "SUPPORT_ADMIN" || normalized === "OWNER") {
    return TenantRole.OWNER;
  }

  if (normalized === "AGENT") {
    return TenantRole.AGENT;
  }

  throw new Error("CLERK_BOOTSTRAP_ROLE must be OWNER or AGENT.");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Clerk admin bootstrap failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
