import type { KnowledgeStructuredMetadata } from "@platform/types";
import { Injectable } from "@nestjs/common";

interface BuildMetadataInput {
  title: string;
  content: string;
  sourceUri?: string | null;
  currentMetadata?: unknown;
}

interface BuildChunkMetadataInput {
  documentMetadata: KnowledgeStructuredMetadata;
  content: string;
  sourceLocator?: unknown;
}

const explicitFieldAliases: Array<{
  field: keyof KnowledgeStructuredMetadata;
  labels: string[];
}> = [
  { field: "productSeries", labels: ["product series", "series", "product line", "range"] },
  { field: "productName", labels: ["product", "product name", "device", "device name", "item"] },
  { field: "modelNumber", labels: ["model", "model number", "sku", "part number"] },
  { field: "deviceType", labels: ["device type", "device/scope", "scope", "category"] },
  { field: "documentType", labels: ["document type", "doc type", "content type"] },
  { field: "language", labels: ["language", "locale"] },
  { field: "version", labels: ["version", "revision", "rev"] },
  { field: "sectionTitle", labels: ["section", "section title", "heading", "topic"] }
];

const intentPatterns: Array<{ intent: string; patterns: RegExp[] }> = [
  { intent: "pairing", patterns: [/\bpair(?:ing|ed)?\b/i, /\bconnect(?:ing|ed)?\b/i, /\bsetup\b/i, /\bset up\b/i, /\bqr code\b/i] },
  { intent: "reset", patterns: [/\breset\b/i, /\bfactory reset\b/i, /\breboot\b/i, /\brestart\b/i] },
  { intent: "installation", patterns: [/\binstall(?:ation|ed|ing)?\b/i, /\bmount(?:ed|ing)?\b/i, /\bwire(?:d|ing)?\b/i] },
  { intent: "warranty", patterns: [/\bwarranty\b/i, /\bguarantee\b/i, /\bcoverage\b/i] },
  { intent: "pricing", patterns: [/\bprice\b/i, /\bpricing\b/i, /\bcost\b/i, /\bfee\b/i, /\bsubscription\b/i] },
  { intent: "compatibility", patterns: [/\bcompatible\b/i, /\bcompatibility\b/i, /\bsupports?\b/i, /\bworks with\b/i] },
  { intent: "troubleshooting", patterns: [/\btroubleshoot(?:ing)?\b/i, /\berror\b/i, /\boffline\b/i, /\bissue\b/i, /\bproblem\b/i] }
];

const genericProductLabels = new Set([
  "general",
  "default",
  "knowledge",
  "knowledge base",
  "faq",
  "faqs",
  "qa",
  "q a",
  "q and a",
  "questions",
  "support",
  "help",
  "customer support",
  "coverage",
  "policy",
  "policies",
  "return",
  "returns",
  "service",
  "service coverage",
  "warranty",
  "example",
  "example domain"
]);

const noisyProductLabelPatterns = [
  /\bfaq(s)?\b/i,
  /\bq\s*(?:&|and)?\s*a\b/i,
  /\bcase stud(?:y|ies)\b/i,
  /\bknowledge base\b/i,
  /\bpolicy\b/i,
  /\bwarrant(?:y|ies)\b/i,
  /\bexample domain\b/i
];

const productSignalPattern =
  /\b(device|devices|remote|remotes|gateway|gateways|lock|locks|panel|panels|sensor|sensors|switch|switches|hub|hubs|bridge|bridges|controller|controllers|module|modules|camera|cameras|plug|plugs|light|lights|thermostat|thermostats|relay|relays|intercom|keypad|reader|readers)\b/i;
const modelNumberWithDigitPattern = /\b[A-Z]{2,}[A-Z0-9-]*\d[A-Z0-9-]*\b/;
const shortModelCodePattern = /^[A-Z0-9-]{4,16}$/;

@Injectable()
export class KnowledgeMetadataService {
  buildDocumentMetadata(input: BuildMetadataInput): KnowledgeStructuredMetadata {
    const explicit = this.extractExplicitMetadata(input.currentMetadata);
    const labelled = this.extractLabelledMetadata(`${input.title}\n${input.content.slice(0, 50_000)}`);
    const inferredTitleProduct = this.inferProductFromTitle(input.title, input.sourceUri);
    const intentHints = this.extractIntentHints(`${input.title}\n${input.content}`);

    const metadata = this.compactMetadata({
      ...labelled,
      ...explicit,
      productName: explicit.productName ?? labelled.productName ?? inferredTitleProduct,
      documentType:
        explicit.documentType ?? labelled.documentType ?? this.inferDocumentType(input.title, input.sourceUri),
      language: explicit.language ?? labelled.language ?? this.inferLanguage(input.content),
      aliases: this.mergeAliases(explicit.aliases, labelled.aliases, [input.title, inferredTitleProduct]),
      intentHints: this.mergeIntents(explicit.intentHints, labelled.intentHints, intentHints)
    });

    return metadata;
  }

  buildChunkMetadata(input: BuildChunkMetadataInput): KnowledgeStructuredMetadata {
    const labelled = this.extractLabelledMetadata(input.content);
    const locatorMetadata = this.extractLocatorMetadata(input.sourceLocator);
    const intentHints = this.extractIntentHints(input.content);

    return this.compactMetadata({
      ...input.documentMetadata,
      ...labelled,
      ...locatorMetadata,
      aliases: this.mergeAliases(input.documentMetadata.aliases, labelled.aliases),
      intentHints: this.mergeIntents(input.documentMetadata.intentHints, labelled.intentHints, intentHints)
    });
  }

  mergeIntoMetadata(currentMetadata: unknown, knowledgeMetadata: KnowledgeStructuredMetadata): Record<string, unknown> {
    const base = isPlainObject(currentMetadata) ? { ...currentMetadata } : {};

    return {
      ...base,
      knowledge: knowledgeMetadata,
      structuredKnowledgeVersion: 1
    };
  }

  readKnowledgeMetadata(value: unknown): KnowledgeStructuredMetadata | null {
    if (!isPlainObject(value)) {
      return null;
    }

    const candidate = isPlainObject(value.knowledge)
      ? value.knowledge
      : isPlainObject(value.knowledgeMetadata)
        ? value.knowledgeMetadata
        : value;
    const explicit = this.extractExplicitMetadata(candidate);

    return Object.keys(explicit).length > 0 ? explicit : null;
  }

  normalizeLabel(value?: string | null): string {
    return (value ?? "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  buildProductLabels(metadata?: KnowledgeStructuredMetadata | null): string[] {
    if (!metadata) {
      return [];
    }

    return uniqueStrings([
      metadata.modelNumber,
      metadata.deviceType,
      metadata.productName,
      metadata.productSeries,
      ...(metadata.aliases ?? [])
    ]).filter((label) => this.isUsableProductLabel(label));
  }

  isUsableProductLabel(label?: string | null): boolean {
    const raw = label?.trim();

    if (!raw) {
      return false;
    }

    if (/\.(?:csv|xlsx?|json|txt|md|markdown)$/i.test(raw)) {
      return false;
    }

    const normalized = this.normalizeLabel(raw);
    const wordCount = normalized.split(" ").filter(Boolean).length;

    if (
      normalized.length < 3 ||
      genericProductLabels.has(normalized) ||
      noisyProductLabelPatterns.some((pattern) => pattern.test(raw))
    ) {
      return false;
    }

    if (this.hasProductSignal(raw)) {
      return true;
    }

    // Short explicit names such as KMREM or Amazon Alexa can be valid
    // product/entity labels; long title-like phrases without product signals are not.
    return wordCount <= 3;
  }

  private extractExplicitMetadata(value: unknown): KnowledgeStructuredMetadata {
    if (!isPlainObject(value)) {
      return {};
    }

    const metadata: KnowledgeStructuredMetadata = {};

    for (const { field } of explicitFieldAliases) {
      const raw = value[field];

      if (typeof raw === "string" && raw.trim()) {
        metadata[field] = raw.trim() as never;
      }
    }

    if (typeof value.pageNumber === "number" && Number.isFinite(value.pageNumber)) {
      metadata.pageNumber = value.pageNumber;
    }

    if (Array.isArray(value.aliases)) {
      metadata.aliases = value.aliases.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim())
      );
    }

    if (Array.isArray(value.intentHints)) {
      metadata.intentHints = value.intentHints.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim())
      );
    }

    return this.compactMetadata(metadata);
  }

  private extractLabelledMetadata(content: string): KnowledgeStructuredMetadata {
    const metadata: KnowledgeStructuredMetadata = {};
    const aliases: string[] = [];
    const intentHints = this.extractIntentHints(content);
    const lines = content.split(/\r?\n/).slice(0, 300);

    for (const line of lines) {
      const match = /^\s*([A-Za-z][A-Za-z0-9 /_-]{1,40})\s*:\s*(.+?)\s*$/.exec(line);

      if (!match) {
        continue;
      }

      const label = this.normalizeLabel(match[1] ?? "");
      const value = (match[2] ?? "").trim();

      if (!value || value.length > 180) {
        continue;
      }

      for (const alias of explicitFieldAliases) {
        if (alias.labels.some((candidate) => this.normalizeLabel(candidate) === label)) {
          if (alias.field === "deviceType" && genericProductLabels.has(this.normalizeLabel(value))) {
            continue;
          }

          metadata[alias.field] = value as never;

          if (["productSeries", "productName", "modelNumber", "deviceType"].includes(alias.field)) {
            aliases.push(value);
          }
        }
      }
    }

    return this.compactMetadata({
      ...metadata,
      aliases,
      intentHints
    });
  }

  private extractLocatorMetadata(sourceLocator: unknown): KnowledgeStructuredMetadata {
    if (!isPlainObject(sourceLocator)) {
      return {};
    }

    const metadata: KnowledgeStructuredMetadata = {};

    if (typeof sourceLocator.sectionTitle === "string") {
      metadata.sectionTitle = sourceLocator.sectionTitle;
    }

    if (typeof sourceLocator.pageNumber === "number") {
      metadata.pageNumber = sourceLocator.pageNumber;
    }

    return this.compactMetadata(metadata);
  }

  private inferProductFromTitle(title: string, sourceUri?: string | null): string | undefined {
    const rawTitle = title || sourceUri || "";
    const documentType = this.inferDocumentType(title, sourceUri);
    const cleaned = rawTitle
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const normalized = this.normalizeLabel(cleaned);

    if (
      !normalized ||
      normalized.length < 3 ||
      genericProductLabels.has(normalized) ||
      ["faq", "case_study", "policy"].includes(documentType ?? "") ||
      noisyProductLabelPatterns.some((pattern) => pattern.test(cleaned)) ||
      !this.hasProductSignal(cleaned)
    ) {
      return undefined;
    }

    return cleaned.slice(0, 80);
  }

  private inferDocumentType(title: string, sourceUri?: string | null): string | undefined {
    const combined = `${title} ${sourceUri ?? ""}`;

    if (/faq|q&a|questions?/i.test(combined)) return "faq";
    if (/case[-\s]?stud(?:y|ies)/i.test(combined)) return "case_study";
    if (/manual|guide|instruction/i.test(combined)) return "manual";
    if (/warranty|policy/i.test(combined)) return "policy";
    if (/spec|datasheet/i.test(combined)) return "specification";

    return undefined;
  }

  private hasProductSignal(value: string): boolean {
    const trimmed = value.trim();

    return (
      productSignalPattern.test(trimmed) ||
      modelNumberWithDigitPattern.test(trimmed) ||
      shortModelCodePattern.test(trimmed)
    );
  }

  private inferLanguage(content: string): string | undefined {
    if (/[\u4e00-\u9fff]/.test(content)) {
      return "zh";
    }

    return undefined;
  }

  private extractIntentHints(content: string): string[] {
    return intentPatterns
      .filter((entry) => entry.patterns.some((pattern) => pattern.test(content)))
      .map((entry) => entry.intent);
  }

  private mergeAliases(...groups: Array<Array<string | undefined> | string | undefined>): string[] | undefined {
    const aliases = groups.flatMap((group) => {
      if (!group) return [];
      return Array.isArray(group) ? group : [group];
    });

    const values = uniqueStrings(aliases).filter((alias) => this.isUsableProductLabel(alias));

    return values.length > 0 ? values : undefined;
  }

  private mergeIntents(...groups: Array<Array<string | undefined> | string | undefined>): string[] | undefined {
    const intents = groups.flatMap((group) => {
      if (!group) return [];
      return Array.isArray(group) ? group : [group];
    });
    const values = uniqueStrings(intents.map((intent) => this.normalizeLabel(intent))).filter(Boolean);

    return values.length > 0 ? values : undefined;
  }

  private compactMetadata(metadata: KnowledgeStructuredMetadata): KnowledgeStructuredMetadata {
    const compact: KnowledgeStructuredMetadata = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "string" && value.trim()) {
        (compact as Record<string, unknown>)[key] = value.trim();
      } else if (typeof value === "number" && Number.isFinite(value)) {
        (compact as Record<string, unknown>)[key] = value;
      } else if (Array.isArray(value)) {
        const values = uniqueStrings(
          value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        );

        if (values.length > 0) {
          (compact as Record<string, unknown>)[key] = values;
        }
      }
    }

    return compact;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();

    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      results.push(normalized);
    }
  }

  return results;
}
