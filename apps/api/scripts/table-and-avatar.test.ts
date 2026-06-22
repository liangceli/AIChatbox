import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { BadRequestException } from "@nestjs/common";
import { AccountService, validateAvatarDataUrl } from "../src/modules/account/account.service";
import { KnowledgeTableImportService } from "../src/modules/knowledge/knowledge-table-import.service";
import { KnowledgeChunkingService } from "../src/modules/knowledge/knowledge-chunking.service";

async function testXlsxQuestionAnswerAndGenericExtraction() {
  const workbook = new ExcelJS.Workbook();
  const faq = workbook.addWorksheet("FAQ");
  faq.addRows([
    ["Question", "Answer", "Category"],
    ["How long is the warranty?", "Twelve months.", "Warranty"],
    ["Can I return an item?", "Contact support within 30 days.", "Returns"]
  ]);
  const catalogue = workbook.addWorksheet("Product matrix");
  catalogue.addRows([
    ["SKU", "Product", "Coverage months"],
    ["A-1", "Starter", 12],
    ["B-2", "Premium", 24]
  ]);
  const bytes = await workbook.xlsx.writeBuffer();
  const service = new KnowledgeTableImportService();
  const result = await service.parse({
    originalname: "support.xlsx",
    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: bytes.byteLength,
    buffer: Buffer.from(bytes)
  });

  assert.equal(result.summary.format, "xlsx");
  assert.equal(result.summary.sheetCount, 2);
  assert.equal(result.summary.qaRecordCount, 2);
  assert.equal(result.summary.structuredRecordCount, 2);
  assert.match(result.content, /\[Sheet: FAQ \| Row: 2\]/);
  assert.match(result.content, /Question: How long is the warranty\?/);
  assert.match(result.content, /Answer: Twelve months\./);
  assert.match(result.content, /SKU: A-1/);
  assert.match(result.content, /Coverage months: 12/);
  const chunks = new KnowledgeChunkingService().chunkText(result.content);
  assert.equal(chunks[0]?.sourceLocator?.sheet, "FAQ");
  assert.equal(chunks[0]?.sourceLocator?.startRow, 2);
}

async function testCsvQuotedValuesArePreserved() {
  const csv = Buffer.from('Customer question,Recommended response,Channel\n"Can I return a large, opened item?","Contact support, with the order number.",Email\n');
  const result = await new KnowledgeTableImportService().parse({
    originalname: "faq.csv",
    mimetype: "text/csv",
    size: csv.length,
    buffer: csv
  });

  assert.equal(result.summary.qaRecordCount, 1);
  assert.match(result.content, /Question: Can I return a large, opened item\?/);
  assert.match(result.content, /Answer: Contact support, with the order number\./);
}

async function testInvalidXlsxSignatureIsRejected() {
  await assert.rejects(
    () => new KnowledgeTableImportService().parse({
      originalname: "fake.xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 8,
      buffer: Buffer.from("not xlsx")
    }),
    BadRequestException
  );
}

function testAvatarSignaturesAndLimits() {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
  assert.doesNotThrow(() => validateAvatarDataUrl(`data:image/jpeg;base64,${jpeg.toString("base64")}`));
  assert.throws(
    () => validateAvatarDataUrl(`data:image/png;base64,${jpeg.toString("base64")}`),
    BadRequestException
  );
}

async function testAvatarUpdateUsesAuthenticatedUserOnly() {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
  const avatarDataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const storedUser = {
    id: "authenticated-user",
    email: "owner@example.test",
    name: "Owner",
    isPlatformAdmin: false,
    metadata: {} as Record<string, unknown>,
    roles: []
  };
  let updatedUserId = "";
  const client = {
    user: {
      findUnique: async () => storedUser,
      update: async (query: { where: { id: string }; data: { metadata: Record<string, unknown> } }) => {
        updatedUserId = query.where.id;
        storedUser.metadata = query.data.metadata;
        return storedUser;
      }
    },
    auditLog: { create: async () => ({}) },
    conversation: { groupBy: async () => [] },
    $transaction: async (callback: (transaction: typeof client) => Promise<unknown>) => callback(client)
  };
  const service = new AccountService({ client } as never);
  const result = await service.updateAvatar(
    { userId: "authenticated-user", email: storedUser.email, isPlatformAdmin: false },
    avatarDataUrl
  );

  assert.equal(updatedUserId, "authenticated-user");
  assert.equal(result.avatarUrl, avatarDataUrl);
  await assert.rejects(
    () => service.updateAvatar({ email: storedUser.email, isPlatformAdmin: false }, avatarDataUrl),
    /mapped account is required/i
  );
}

async function run() {
  await testXlsxQuestionAnswerAndGenericExtraction();
  await testCsvQuotedValuesArePreserved();
  await testInvalidXlsxSignatureIsRejected();
  testAvatarSignaturesAndLimits();
  await testAvatarUpdateUsesAuthenticatedUserOnly();
}

void run();
