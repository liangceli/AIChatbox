import { loadServerEnv } from "@platform/config";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import type { LookupFunction } from "node:net";
import type {
  SafeUrlAddress,
  SafeUrlResolution
} from "./knowledge-url-safety.service";
import { KnowledgeUrlSafetyService } from "./knowledge-url-safety.service";

interface ImportedUrlContent {
  title: string | null;
  content: string;
}

interface SafeHttpResponse {
  status: number;
  contentType: string;
  location?: string;
  body: string;
}

type SafeHttpRequester = (
  resolution: SafeUrlResolution,
  userAgent: string,
  deadlineMs: number
) => Promise<SafeHttpResponse>;

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const URL_IMPORT_FLOW_TIMEOUT_MS = 45_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

@Injectable()
export class KnowledgeUrlImportService {
  private readonly importUserAgent = loadServerEnv(process.env).KNOWLEDGE_IMPORT_USER_AGENT;
  private requester: SafeHttpRequester = requestPinnedPublicUrl;
  private requestDeadlineMs = REQUEST_TIMEOUT_MS;
  private flowDeadlineMs = URL_IMPORT_FLOW_TIMEOUT_MS;

  constructor(
    @Inject(KnowledgeUrlSafetyService)
    private readonly urlSafetyService: KnowledgeUrlSafetyService
  ) {}

  static createForTest(
    urlSafetyService: KnowledgeUrlSafetyService,
    requester: SafeHttpRequester,
    options?: { requestDeadlineMs?: number; flowDeadlineMs?: number }
  ): KnowledgeUrlImportService {
    const service = new KnowledgeUrlImportService(urlSafetyService);
    service.requester = requester;
    service.requestDeadlineMs = options?.requestDeadlineMs ?? service.requestDeadlineMs;
    service.flowDeadlineMs = options?.flowDeadlineMs ?? service.flowDeadlineMs;

    return service;
  }

  async fetchContent(rawUrl: string): Promise<ImportedUrlContent> {
    let currentUrl = rawUrl;
    const flowStartedAt = Date.now();

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const remainingFlowMs = this.getRemainingFlowDeadlineMs(flowStartedAt);
      const resolution = await this.urlSafetyService.resolveSafePublicUrl(currentUrl);
      let response: SafeHttpResponse;

      try {
        response = await this.requester(
          resolution,
          this.importUserAgent,
          Math.min(this.requestDeadlineMs, remainingFlowMs)
        );
      } catch {
        throw new BadRequestException("Unable to fetch URL safely.");
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        if (!response.location) {
          throw new BadRequestException("URL redirect did not provide a target.");
        }

        if (redirectCount === MAX_REDIRECTS) {
          throw new BadRequestException(`URL import exceeded ${MAX_REDIRECTS} redirects.`);
        }

        try {
          currentUrl = new URL(response.location, resolution.url).toString();
        } catch {
          throw new BadRequestException("URL redirect target is invalid.");
        }

        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        throw new BadRequestException(`URL fetch failed with status ${response.status}.`);
      }

      return this.parseResponse(response);
    }

    throw new BadRequestException(`URL import exceeded ${MAX_REDIRECTS} redirects.`);
  }

  private getRemainingFlowDeadlineMs(flowStartedAt: number): number {
    const remainingMs = this.flowDeadlineMs - (Date.now() - flowStartedAt);

    if (remainingMs <= 0) {
      throw new BadRequestException("URL import exceeded the overall import deadline.");
    }

    return remainingMs;
  }

  private parseResponse(response: SafeHttpResponse): ImportedUrlContent {
    const contentType = response.contentType.toLowerCase();

    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      throw new BadRequestException(
        `Unsupported URL content type: ${response.contentType || "unknown"}.`
      );
    }

    const title = this.extractHtmlTitle(response.body);
    const content = contentType.includes("text/html")
      ? this.extractReadableText(response.body)
      : this.normalizeReadableText(response.body);

    if (!content || content.length < 40) {
      throw new BadRequestException("Fetched URL did not contain enough readable text.");
    }

    return {
      title,
      content: content.slice(0, 50000)
    };
  }

  private extractHtmlTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    return match ? this.decodeHtml(match[1]!).replace(/\s+/g, " ").trim() : null;
  }

  private extractReadableText(html: string): string {
    const withoutNoise = html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<(nav|footer|header|aside|form|button|svg|canvas)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+(?:hidden|aria-hidden=["']?true["']?)[^>]*>[\s\S]*?<\/[^>]+>/gi, " ");

    return this.normalizeReadableText(
      this.decodeHtml(
        withoutNoise
          .replace(/<\/(h1|h2|h3|h4)>/gi, "\n")
          .replace(/<\/(p|div|section|article|li|tr)>/gi, "\n")
          .replace(/<[^>]+>/g, " ")
      )
    );
  }

  private normalizeReadableText(value: string): string {
    const lines = value
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const normalizedLines: string[] = [];
    const seenLines = new Set<string>();

    for (const line of lines) {
      const key = line.toLowerCase();

      if (seenLines.has(key)) {
        continue;
      }

      seenLines.add(key);
      normalizedLines.push(line);
    }

    return normalizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  private decodeHtml(value: string): string {
    return value
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'");
  }
}

export function requestPinnedPublicUrl(
  resolution: SafeUrlResolution,
  userAgent: string,
  deadlineMs = REQUEST_TIMEOUT_MS
): Promise<SafeHttpResponse> {
  return new Promise((resolve, reject) => {
    const transport = resolution.url.protocol === "https:" ? requestHttps : requestHttp;
    const lookup = createPinnedLookup(resolution.addresses);
    let request: ClientRequest | undefined;
    let response: IncomingMessage | undefined;
    let settled = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const finishResolve = (result: SafeHttpResponse) => {
      if (settled) {
        return;
      }

      settled = true;
      if (deadline) {
        clearTimeout(deadline);
      }
      resolve(result);
    };
    const finishReject = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      if (deadline) {
        clearTimeout(deadline);
      }
      reject(error);
    };

    try {
      request = transport(
        resolution.url,
        {
          headers: {
            accept: "text/html,text/plain;q=0.9",
            "user-agent": userAgent
          },
          lookup
        },
        (incomingResponse) => {
          response = incomingResponse;
          const chunks: Buffer[] = [];
          let totalBytes = 0;

          incomingResponse.on("data", (chunk: Buffer | string) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += buffer.length;

            if (totalBytes > MAX_RESPONSE_BYTES) {
              incomingResponse.destroy(new Error("URL response exceeded maximum size."));
              return;
            }

            chunks.push(buffer);
          });
          incomingResponse.on("end", () => {
            finishResolve({
              status: incomingResponse.statusCode ?? 500,
              contentType: readHeader(incomingResponse.headers["content-type"]),
              location: readOptionalHeader(incomingResponse.headers.location),
              body: Buffer.concat(chunks).toString("utf8")
            });
          });
          incomingResponse.on("error", finishReject);
        }
      );
    } catch (error: unknown) {
      finishReject(toError(error));
      return;
    }

    request.on("error", finishReject);
    deadline = setTimeout(() => {
      const error = new Error("URL request exceeded absolute deadline.");

      response?.destroy(error);
      request?.destroy(error);
      finishReject(error);
    }, deadlineMs);
    try {
      request.end();
    } catch (error: unknown) {
      request.destroy();
      finishReject(toError(error));
    }
  });
}

export function createPinnedLookup(addresses: SafeUrlAddress[]): LookupFunction {
  const validatedAddresses = addresses.map((entry) => ({ ...entry }));
  const selectedAddress = selectAddress(validatedAddresses);

  return (_hostname, options, callback) => {
    if (typeof options === "object" && options.all) {
      callback(null, validatedAddresses);
      return;
    }

    callback(null, selectedAddress.address, selectedAddress.family);
  };
}

function selectAddress(addresses: SafeUrlAddress[]): SafeUrlAddress {
  const selected = addresses[0];

  if (!selected) {
    throw new Error("No validated URL address is available.");
  }

  return selected;
}

function readHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function readOptionalHeader(value: string | string[] | undefined): string | undefined {
  const header = readHeader(value);
  return header || undefined;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("URL request failed.");
}
