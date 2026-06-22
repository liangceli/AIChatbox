import { Readable } from "node:stream";
import type { KnowledgeTableExtractionSummary } from "@platform/types";
import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS, { type Worksheet } from "exceljs";

export interface UploadedKnowledgeFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ParsedKnowledgeTable {
  content: string;
  summary: KnowledgeTableExtractionSummary;
}

type TableRow = { rowNumber: number; values: string[] };

const questionAliases = new Set([
  "q", "question", "questions", "query", "queries", "customerquestion", "userquestion",
  "issue", "problem", "request", "faqquestion"
]);
const answerAliases = new Set([
  "a", "answer", "answers", "response", "reply", "solution", "resolution", "guidance",
  "faqanswer", "recommendedanswer", "recommendedresponse", "suggestedanswer", "suggestedresponse",
  "supportanswer", "supportresponse"
]);

@Injectable()
export class KnowledgeTableImportService {
  private readonly maximumFileBytes = 5 * 1024 * 1024;
  private readonly maximumRows = 10_000;
  private readonly maximumColumns = 100;
  private readonly maximumExtractedCharacters = 5_000_000;

  async parse(file: UploadedKnowledgeFile): Promise<ParsedKnowledgeTable> {
    this.validateFile(file);
    const format = this.resolveFormat(file.originalname);
    const workbook = new ExcelJS.Workbook();

    try {
      if (format === "xlsx") {
        await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      } else {
        await workbook.csv.read(Readable.from(file.buffer));
      }
    } catch {
      throw new BadRequestException(`Unable to read ${format.toUpperCase()} file. Check that it is not password protected or corrupted.`);
    }

    const records: string[] = [];
    const warnings: string[] = [];
    let qaRecordCount = 0;
    let structuredRecordCount = 0;

    for (const worksheet of workbook.worksheets.slice(0, 25)) {
      const rows = this.readRows(worksheet);

      if (rows.length === 0) {
        warnings.push(`Sheet "${worksheet.name}" did not contain readable values.`);
        continue;
      }

      const headerIndex = this.detectHeaderIndex(rows);
      const headerRow = headerIndex >= 0 ? rows[headerIndex] : undefined;
      const headers = headerRow ? this.buildHeaders(headerRow.values) : [];
      const questionIndex = headers.findIndex((header) => matchesAlias(header, questionAliases));
      const answerIndex = headers.findIndex((header) => matchesAlias(header, answerAliases));
      const dataRows = headerRow ? rows.slice(headerIndex + 1) : rows;
      let sheetQaCount = 0;
      let genericHeaderContext = headerRow && (questionIndex < 0 || answerIndex < 0)
        ? `Detected columns from row ${headerRow.rowNumber}: ${headers.join(" | ")}`
        : "";

      for (const row of dataRows) {
        if (headerRow && this.isRepeatedHeader(row.values, headerRow.values)) {
          continue;
        }

        const populated = row.values.filter(Boolean);

        if (populated.length === 0) {
          continue;
        }

        const locator = `[Sheet: ${worksheet.name} | Row: ${row.rowNumber}]`;
        const question = questionIndex >= 0 ? row.values[questionIndex]?.trim() : "";
        const answer = answerIndex >= 0 ? row.values[answerIndex]?.trim() : "";

        if (question && answer) {
          const context = row.values
            .map((value, index) => ({ header: headers[index], value }))
            .filter((entry, index) => entry.value && index !== questionIndex && index !== answerIndex)
            .map((entry) => `${entry.header}: ${entry.value}`)
            .join("\n");
          records.push(`${locator}\nQuestion: ${question}\nAnswer: ${answer}${context ? `\nContext:\n${context}` : ""}`);
          qaRecordCount += 1;
          sheetQaCount += 1;
          continue;
        }

        const fields = row.values
          .map((value, index) => ({ label: headerRow ? headers[index] : columnLabel(index), value }))
          .filter((entry) => entry.value)
          .map((entry) => `${entry.label}: ${entry.value}`);

        if (fields.length > 0) {
          records.push(`${genericHeaderContext ? `${genericHeaderContext}\n` : ""}${locator}\n${fields.join("\n")}`);
          genericHeaderContext = "";
          structuredRecordCount += 1;
        }
      }

      if (sheetQaCount === 0) {
        warnings.push(`Sheet "${worksheet.name}" was imported as structured records because no reliable Question/Answer column pair was found.`);
      }
    }

    if (workbook.worksheets.length > 25) {
      warnings.push("Only the first 25 worksheets were imported.");
    }

    const content = records.join("\n\n");

    if (!content) {
      throw new BadRequestException("The uploaded table did not contain any usable records.");
    }

    if (content.length > this.maximumExtractedCharacters) {
      throw new BadRequestException("The extracted table content is too large. Split the file into smaller uploads.");
    }

    return {
      content,
      summary: {
        format,
        sheetCount: Math.min(workbook.worksheets.length, 25),
        recordCount: records.length,
        qaRecordCount,
        structuredRecordCount,
        warnings
      }
    };
  }

  private validateFile(file: UploadedKnowledgeFile): void {
    if (!file?.buffer || file.size <= 0) {
      throw new BadRequestException("Choose a non-empty CSV or XLSX file.");
    }

    if (file.size > this.maximumFileBytes) {
      throw new BadRequestException("Knowledge table files must be 5 MB or smaller.");
    }

    const format = this.resolveFormat(file.originalname);

    if (format === "xlsx" && !file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      throw new BadRequestException("The XLSX file signature is invalid.");
    }

    if (format === "csv" && file.buffer.includes(0)) {
      throw new BadRequestException("The CSV file appears to contain binary data.");
    }
  }

  private resolveFormat(fileName: string): "csv" | "xlsx" {
    const normalized = fileName.trim().toLowerCase();

    if (normalized.endsWith(".csv")) return "csv";
    if (normalized.endsWith(".xlsx")) return "xlsx";

    throw new BadRequestException("Only .csv and .xlsx table files are supported.");
  }

  private readRows(worksheet: Worksheet): TableRow[] {
    if (worksheet.rowCount > this.maximumRows || worksheet.columnCount > this.maximumColumns) {
      throw new BadRequestException(`Sheet "${worksheet.name}" exceeds the 10,000 row or 100 column import limit.`);
    }

    const rows: TableRow[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        values[columnNumber - 1] = normalizeCellText(cell.text);
      });

      if (values.some(Boolean)) {
        rows.push({ rowNumber, values });
      }
    });
    return rows;
  }

  private detectHeaderIndex(rows: TableRow[]): number {
    const candidates = rows.slice(0, 10);
    let best = { index: -1, score: 0 };

    candidates.forEach((row, index) => {
      const populated = row.values.filter(Boolean);

      if (populated.length < 2) return;
      const semanticMatches = populated.filter((value) => {
        const key = normalizeHeader(value);
        return matchesNormalizedAlias(key, questionAliases) || matchesNormalizedAlias(key, answerAliases);
      }).length;
      const uniqueRatio = new Set(populated.map(normalizeHeader)).size / populated.length;
      const followingRows = rows.slice(index + 1, index + 4);
      const overlap = followingRows.filter((candidate) => candidate.values.filter(Boolean).length >= Math.min(2, populated.length)).length;
      const score = semanticMatches * 10 + uniqueRatio * 2 + overlap;
      const credible = semanticMatches > 0 || (overlap >= 2 && populated.every((value) => /[A-Za-z]/.test(value)));

      if (credible && score > best.score) best = { index, score };
    });

    return best.index;
  }

  private buildHeaders(values: string[]): string[] {
    const seen = new Map<string, number>();
    return values.map((value, index) => {
      const base = value.trim() || columnLabel(index);
      const count = seen.get(base.toLowerCase()) ?? 0;
      seen.set(base.toLowerCase(), count + 1);
      return count === 0 ? base : `${base} ${count + 1}`;
    });
  }

  private isRepeatedHeader(values: string[], headerValues: string[]): boolean {
    const populatedHeaders = headerValues.map(normalizeHeader).filter(Boolean);
    const populatedValues = values.map(normalizeHeader).filter(Boolean);
    return populatedHeaders.length > 0 && populatedHeaders.join("|") === populatedValues.join("|");
  }
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesAlias(value: string, aliases: Set<string>): boolean {
  return matchesNormalizedAlias(normalizeHeader(value), aliases);
}

function matchesNormalizedAlias(normalized: string, aliases: Set<string>): boolean {
  if (aliases.has(normalized)) return true;
  return [...aliases].some((alias) => alias.length >= 5 && normalized.includes(alias));
}

function normalizeCellText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, 20_000);
}

function columnLabel(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return `Column ${label}`;
}
