import { prisma } from "@platform/database";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { ConversationStateService } from "../src/modules/knowledge/conversation-state.service";
import { KnowledgeMetadataService } from "../src/modules/knowledge/knowledge-metadata.service";

loadRootEnv();

async function main() {
  const tenantSlug = process.env.TENANT_SLUG?.trim();
  const tenants = await prisma.tenant.findMany({
    where: tenantSlug
      ? {
          slug: tenantSlug
        }
      : undefined,
    select: {
      id: true,
      slug: true
    },
    orderBy: {
      slug: "asc"
    }
  });
  const stateService = new ConversationStateService(
    { client: prisma } as PrismaService,
    new KnowledgeMetadataService()
  );

  if (tenantSlug && tenants.length === 0) {
    console.log(`No tenant found for slug "${tenantSlug}".`);
    return;
  }

  for (const tenant of tenants) {
    const upserted = await stateService.backfillTenantProductCatalog(tenant.id);

    console.log(`tenant=${tenant.slug} productCatalogUpserts=${upserted}`);
  }
}

function loadRootEnv() {
  const envPath = resolve(__dirname, "../../../.env");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = rawValue.replace(/^["']|["']$/gu, "");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
