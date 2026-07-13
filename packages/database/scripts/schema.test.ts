import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(__dirname, "..");
const schema = readFileSync(resolve(packageRoot, "prisma", "schema.prisma"), "utf8");
const repairMigration = readFileSync(
  resolve(
    packageRoot,
    "prisma",
    "migrations",
    "20260713000000_fix_knowledge_chunk_version_index",
    "migration.sql"
  ),
  "utf8"
);

assert.match(
  schema,
  /@@unique\(\[tenantId, knowledgeDocumentId, version, chunkIndex\]\)/,
  "Knowledge chunk uniqueness must include the document version."
);
assert.match(
  repairMigration,
  /DROP INDEX IF EXISTS "KnowledgeChunk_tenantId_knowledgeDocumentId_chunkIndex_key"/,
  "The forward migration must remove the legacy version-blind unique index."
);
