import { PrismaClient, TenantStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "kasta" },
    update: {
      name: "Kasta",
      status: TenantStatus.ACTIVE,
      defaultLocale: "en-AU",
      branding: {
        name: "Kasta",
        primaryColor: "#1d4ed8",
        accentColor: "#0f172a",
        supportEmail: "support@kasta.example"
      }
    },
    create: {
      slug: "kasta",
      name: "Kasta",
      status: TenantStatus.ACTIVE,
      defaultLocale: "en-AU",
      branding: {
        name: "Kasta",
        primaryColor: "#1d4ed8",
        accentColor: "#0f172a",
        supportEmail: "support@kasta.example"
      }
    }
  });

  const user = await prisma.user.upsert({
    where: { email: "support@kasta.example" },
    update: {
      name: "Kasta Support Admin",
      isPlatformAdmin: false
    },
    create: {
      email: "support@kasta.example",
      name: "Kasta Support Admin",
      isPlatformAdmin: false
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
      name: "SUPPORT_ADMIN"
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      name: "SUPPORT_ADMIN"
    }
  });

  await prisma.agentConfig.upsert({
    where: { tenantId: tenant.id },
    update: {
      displayName: "Kasta Support Assistant",
      systemPrompt:
        "You are the first-line support assistant for this tenant. Answer clearly and escalate later when needed.",
      welcomeMessage: "Hi, I can help with quick support questions.",
      fallbackMessage: "I received your message and will help with the next step.",
      handoffEnabled: true,
      widgetSettings: {
        title: "Kasta Support",
        headerBackground: "linear-gradient(135deg, #0f172a, #1d4ed8)"
      }
    },
    create: {
      tenantId: tenant.id,
      displayName: "Kasta Support Assistant",
      systemPrompt:
        "You are the first-line support assistant for this tenant. Answer clearly and escalate later when needed.",
      welcomeMessage: "Hi, I can help with quick support questions.",
      fallbackMessage: "I received your message and will help with the next step.",
      handoffEnabled: true,
      widgetSettings: {
        title: "Kasta Support",
        headerBackground: "linear-gradient(135deg, #0f172a, #1d4ed8)"
      }
    }
  });

  await prisma.knowledgeBase.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: "default"
      }
    },
    update: {
      name: "Default Knowledge Base",
      description: "Starter knowledge base for local development."
    },
    create: {
      tenantId: tenant.id,
      slug: "default",
      name: "Default Knowledge Base",
      description: "Starter knowledge base for local development."
    }
  });

  console.log(
    JSON.stringify(
      {
        seeded: true,
        tenant: tenant.slug,
        adminEmail: user.email
      },
      null,
      2
    )
  );
}

main()
  .catch(async (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
