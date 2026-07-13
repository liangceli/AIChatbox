import type { LlmRetrievedKnowledgeChunk } from "@platform/ai-core";
import { KnowledgeChunkStatus, KnowledgeDocumentStatus } from "@platform/database";
import type { KnowledgeStructuredMetadata } from "@platform/types";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { KnowledgeMetadataService } from "./knowledge-metadata.service";
import {
  ConversationContextService,
  type ConversationTurnType
} from "./conversation-context.service";
import { KnowledgeSemanticSearchService } from "./knowledge-semantic-search.service";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "it",
  "me",
  "is",
  "of",
  "on",
  "one",
  "or",
  "product",
  "products",
  "the",
  "that",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you"
]);

const SUPPORT_SYNONYMS: Record<string, string[]> = {
  cancel: ["cancellation"],
  cancellation: ["cancel"],
  connect: ["pair", "pairing", "paired", "setup"],
  cost: ["price", "pricing"],
  delivery: ["shipping"],
  exchange: ["return"],
  guarantee: ["warranty"],
  help: ["support"],
  install: ["installation", "setup"],
  installation: ["install", "setup"],
  invoice: ["bill", "receipt"],
  pair: ["paired", "pairing", "connect", "setup"],
  paired: ["pair", "pairing", "connect", "setup"],
  pairing: ["pair", "paired", "connect", "setup"],
  price: ["cost", "pricing"],
  pricing: ["price", "cost"],
  coastal: ["marine", "seaside", "corrosion"],
  dim: ["dimmer", "dimming", "dimmable"],
  dimmer: ["dim", "dimming", "dimmable"],
  dimming: ["dim", "dimmer", "dimmable"],
  exterior: ["outdoor", "outside", "weatherproof"],
  marine: ["coastal", "seaside", "corrosion"],
  outdoor: ["outside", "exterior", "weatherproof"],
  outside: ["outdoor", "exterior", "weatherproof"],
  refund: ["return"],
  repair: ["fix", "troubleshoot", "service"],
  reset: ["restart", "reboot"],
  receipt: ["invoice"],
  return: ["refund", "exchange"],
  setup: ["set up", "connect", "pair", "install"],
  shipping: ["delivery"],
  support: ["help"],
  fix: ["repair", "troubleshoot"],
  warranty: ["guarantee", "coverage"],
  wet: ["waterproof", "damp", "bathroom", "ip"],
  waterproof: ["wet", "damp", "weatherproof", "ip"]
};

const INTENT_TERMS: Record<string, string[]> = {
  pairing: ["pair", "paired", "pairing", "connect", "setup", "set up", "qr"],
  reset: ["reset", "restart", "reboot"],
  installation: ["install", "installation", "mount", "wire", "setup"],
  warranty: ["warranty", "guarantee", "coverage"],
  pricing: ["price", "pricing", "cost", "fee", "subscription"],
  compatibility: ["compatible", "compatibility", "support", "supports", "works"],
  troubleshooting: [
    "troubleshoot",
    "troubleshooting",
    "repair",
    "fix",
    "broken",
    "damaged",
    "error",
    "offline",
    "issue",
    "problem"
  ]
};

const PRODUCT_CLARIFICATION_INTENTS = new Set([
  "pairing",
  "reset",
  "installation",
  "compatibility",
  "troubleshooting"
]);

const PRODUCT_ENTITY_SIGNAL_PATTERN =
  /\b(device|devices|remote|remotes|gateway|gateways|lock|locks|panel|panels|sensor|sensors|switch|switches|hub|hubs|bridge|bridges|controller|controllers|module|modules|camera|cameras|plug|plugs|light|lights|thermostat|thermostats|relay|relays|intercom|keypad|reader|readers)\b|\b[A-Z]{2,}[A-Z0-9-]*\d[A-Z0-9-]*\b/;
const SHORT_MODEL_CODE_PATTERN = /^[A-Z0-9-]{4,16}$/;
const GENERIC_MODEL_TERMS = new Set([
  "alexa",
  "apple",
  "bluetooth",
  "device",
  "gateway",
  "general",
  "google",
  "home",
  "lock",
  "matter",
  "product",
  "remote",
  "samsung",
  "thread",
  "wifi",
  "zigbee"
]);
const CLARIFICATION_TTL_MS = 20 * 60 * 1000;
const KEYWORD_TOP_K = 20;
const VECTOR_TOP_K = 20;
const SEMANTIC_POOL_LIMIT = 400;
const NO_EVIDENCE_THRESHOLD = 0.55;
const STRONG_CONFIDENCE_THRESHOLD = 0.75;

export interface NormalisedKnowledgeQuery {
  originalQuestion: string;
  effectiveQuestion: string;
  keywords: string[];
  phrases: string[];
  modelNumbers: string[];
  productNames: string[];
  synonyms: string[];
  intent?: string;
}

export interface HybridRetrievalScore {
  chunkId: string;
  keywordScore: number;
  vectorScore: number;
  metadataScore: number;
  exactMatchBoost: number;
  finalScore: number;
  reasons: string[];
}

export interface HybridRetrievalMetadata {
  retrievalMode: "HYBRID";
  originalQuestion: string;
  effectiveQuestion: string;
  intent?: string;
  usedPendingClarification: boolean;
  usedProductContext: boolean;
  keywordTopK: number;
  vectorTopK: number;
  finalTopK: number;
  keywordCandidateChunkIds: string[];
  vectorCandidateChunkIds: string[];
  mergedCandidateChunkIds: string[];
  selectedChunkIds: string[];
  scores: HybridRetrievalScore[];
  confidence: number;
  noKnowledgeEvidence: boolean;
  ambiguity: {
    detected: boolean;
    candidateProductNames: string[];
  };
}

interface ScoredCandidate {
  score: number;
  coverage: number;
  keywordScore: number;
  vectorScore: number;
  metadataScore: number;
  exactMatchBoost: number;
  reasons: string[];
  chunk: LlmRetrievedKnowledgeChunk;
  knowledgeMetadata: KnowledgeStructuredMetadata | null;
}

interface ProductGroup {
  label: string;
  score: number;
  knowledgeMetadata: KnowledgeStructuredMetadata;
}

interface KnowledgeCandidateRecord {
  id: string;
  content: string;
  chunkIndex: number;
  sourceLocator: unknown;
  metadata: unknown;
  knowledgeDocument: {
    id: string;
    title: string;
    sourceUri: string | null;
    metadata: unknown;
  };
}

interface HybridSearchResult {
  ranked: ScoredCandidate[];
  productGroups: ProductGroup[];
  keywordCandidateChunkIds: string[];
  vectorCandidateChunkIds: string[];
  mergedCandidateChunkIds: string[];
}

export interface RetrievalPendingClarificationOption {
  label: string;
  knowledgeMetadata: KnowledgeStructuredMetadata;
}

export interface RetrievalPendingClarification {
  type?: "PRODUCT_DISAMBIGUATION";
  originalQuestion: string;
  intent?: string;
  options: RetrievalPendingClarificationOption[];
  createdAt?: string;
  expiresAt?: string;
}

export interface KnowledgeRetrievalContext {
  productContext?: KnowledgeStructuredMetadata | null;
  pendingClarification?: RetrievalPendingClarification | null;
}

export interface KnowledgeRetrievalConfidence {
  level: "strong" | "weak" | "none";
  reason: string;
  bestScore?: number;
  bestCoverage?: number;
  scoreGap?: number;
}

export interface KnowledgeRetrievalDecision {
  mode: "answer" | "clarification";
  effectiveQuestion: string;
  retrievedChunks: LlmRetrievedKnowledgeChunk[];
  intent?: string;
  productContext?: KnowledgeStructuredMetadata | null;
  pendingClarification?: RetrievalPendingClarification | null;
  ambiguity: {
    isAmbiguous: boolean;
    intent?: string;
    productContext?: KnowledgeStructuredMetadata | null;
    clarificationQuestion?: string;
    options: string[];
  };
  confidence: KnowledgeRetrievalConfidence;
  warnings: string[];
  turnType?: ConversationTurnType;
  retrievalMetadata: HybridRetrievalMetadata;
}

@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KnowledgeMetadataService)
    private readonly knowledgeMetadataService: KnowledgeMetadataService,
    @Inject(ConversationContextService)
    private readonly conversationContextService: ConversationContextService,
    @Optional()
    @Inject(KnowledgeSemanticSearchService)
    private readonly semanticSearchService: KnowledgeSemanticSearchService =
      new KnowledgeSemanticSearchService()
  ) {}

  async retrieveRelevantChunks(
    tenant: ResolvedTenant,
    question: string,
    limit = 3
  ): Promise<LlmRetrievedKnowledgeChunk[]> {
    const decision = await this.resolveRetrievalDecision(tenant, question, undefined, limit);

    return decision.mode === "answer" ? decision.retrievedChunks : [];
  }

  async resolveRetrievalDecision(
    tenant: ResolvedTenant,
    question: string,
    context?: unknown,
    limit = 3
  ): Promise<KnowledgeRetrievalDecision> {
    const normalizedQuestion = question.trim();
    const retrievalContext = this.readRetrievalContext(context);
    const directIntent = this.detectIntent(normalizedQuestion);
    const turnType = this.conversationContextService.classifyTurn(normalizedQuestion, {
      detectedIntent: directIntent,
      pendingIntent: retrievalContext.pendingClarification?.intent,
      hasPendingClarification: Boolean(retrievalContext.pendingClarification),
      hasProductContext: Boolean(retrievalContext.productContext)
    });

    if (
      retrievalContext.pendingClarification &&
      (turnType === "greeting" || turnType === "thanks")
    ) {
      return {
        mode: "answer",
        effectiveQuestion: normalizedQuestion,
        retrievedChunks: [],
        productContext: retrievalContext.productContext ?? null,
        pendingClarification: retrievalContext.pendingClarification,
        ambiguity: {
          isAmbiguous: false,
          productContext: retrievalContext.productContext ?? null,
          options: []
        },
        confidence: {
          level: "none",
          reason: "The customer message is a conversational interruption, not a product clarification response."
        },
        warnings: ["Pending product clarification was preserved while handling a conversational interruption."],
        turnType,
        retrievalMetadata: this.buildHybridMetadata(
          this.buildNormalisedQuery(normalizedQuestion, normalizedQuestion, directIntent),
          {
            ranked: [],
            productGroups: [],
            keywordCandidateChunkIds: [],
            vectorCandidateChunkIds: [],
            mergedCandidateChunkIds: []
          },
          [],
          0,
          limit,
          false,
          [],
          false,
          false
        )
      };
    }

    const activePendingClarification = turnType === "new_question" ? null : retrievalContext.pendingClarification;
    const clarifiedScope = this.resolvePendingClarification(normalizedQuestion, activePendingClarification);
    const pendingClarificationReply = Boolean(
      !clarifiedScope &&
        activePendingClarification &&
        turnType === "clarification_reply" &&
        this.shouldTreatAsPendingClarificationReply(normalizedQuestion, activePendingClarification)
    );
    const effectiveQuestion = clarifiedScope || pendingClarificationReply
      ? `${clarifiedScope?.originalQuestion ?? activePendingClarification?.originalQuestion ?? normalizedQuestion} ${normalizedQuestion}`
      : normalizedQuestion;
    const intent =
      clarifiedScope?.intent ??
      (pendingClarificationReply ? activePendingClarification?.intent : undefined) ??
      directIntent ??
      this.detectIntent(effectiveQuestion);
    const queryProductContext =
      turnType === "follow_up" ? retrievalContext.productContext ?? null : null;
    const normalisedQuery = this.buildNormalisedQuery(
      normalizedQuestion,
      effectiveQuestion,
      intent,
      queryProductContext
    );
    const tokens = normalisedQuery.keywords;
    const candidateTerms = Array.from(
      new Set([
        ...this.extractShortModelLookupVariants(normalizedQuestion),
        ...this.extractCandidateSearchTerms(effectiveQuestion),
        ...normalisedQuery.keywords,
        ...normalisedQuery.synonyms,
        ...normalisedQuery.modelNumbers
      ])
    ).slice(0, 32);
    const phrases = normalisedQuery.phrases;
    const warnings: string[] = [];

    if (tokens.length === 0 || candidateTerms.length === 0) {
      return this.emptyAnswerDecision(
        normalizedQuestion,
        effectiveQuestion,
        intent,
        warnings,
        turnType,
        limit
      );
    }

    const hybridSearch = await this.searchHybridCandidates(
      tenant,
      normalisedQuery,
      candidateTerms
    );
    const scored = hybridSearch.ranked;
    const mentionedScope = pendingClarificationReply
      ? this.resolveMentionedProductContext(normalizedQuestion, scored, { requireStrongMatch: true })
      : this.resolveMentionedProductContext(effectiveQuestion, scored);
    const requestedScope =
      clarifiedScope?.knowledgeMetadata ??
      mentionedScope ??
      (turnType === "follow_up" ? retrievalContext.productContext : null) ??
      null;
    const productGroups = hybridSearch.productGroups;

    if (
      activePendingClarification &&
      !clarifiedScope &&
      !requestedScope &&
      this.shouldRepeatPendingClarification(normalizedQuestion, activePendingClarification, intent, tokens)
    ) {
      const options = activePendingClarification.options.slice(0, 4);
      const clarificationQuestion = this.buildClarificationQuestion(
        activePendingClarification.intent,
        options.map((option) => option.label)
      );

      return {
        mode: "clarification",
        effectiveQuestion: activePendingClarification.originalQuestion,
        retrievedChunks: [],
        intent: activePendingClarification.intent,
        productContext: null,
        pendingClarification: activePendingClarification,
        ambiguity: {
          isAmbiguous: true,
          intent: activePendingClarification.intent,
          clarificationQuestion,
          options: options.map((option) => option.label)
        },
        confidence: {
          level: "none",
          reason: "The user response did not match any pending clarification option."
        },
        warnings: [
          ...warnings,
          "Pending product clarification could not be resolved; repeating clarification instead of answering from weak context."
        ],
        turnType,
        retrievalMetadata: this.buildHybridMetadata(
          normalisedQuery,
          hybridSearch,
          [],
          0,
          limit,
          true,
          options.map((option) => option.label),
          Boolean(clarifiedScope || pendingClarificationReply),
          false
        )
      };
    }

    if (
      !requestedScope &&
      (this.shouldAskClarification(tokens, intent, productGroups) ||
        this.shouldAskOpenProductClarification(tokens, intent, productGroups, scored, pendingClarificationReply))
    ) {
      const options = productGroups.slice(0, 4).map((group) => ({
        label: group.label,
        knowledgeMetadata: group.knowledgeMetadata
      }));
      const clarificationQuestion = this.buildClarificationQuestion(intent, options.map((option) => option.label));

      return {
        mode: "clarification",
        effectiveQuestion,
        retrievedChunks: [],
        intent,
        productContext: null,
        pendingClarification: {
          type: "PRODUCT_DISAMBIGUATION",
          originalQuestion: effectiveQuestion,
          intent,
          options,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + CLARIFICATION_TTL_MS).toISOString()
        },
        ambiguity: {
          isAmbiguous: true,
          intent,
          clarificationQuestion,
          options: options.map((option) => option.label)
        },
        confidence: {
          level: "none",
          reason: "The question matched multiple product scopes without a resolved product."
        },
        warnings: [
          ...warnings,
          "Multiple product scopes matched a short product-action question; asking for clarification instead of guessing."
        ],
        turnType,
        retrievalMetadata: this.buildHybridMetadata(
          normalisedQuery,
          hybridSearch,
          [],
          0,
          limit,
          true,
          options.map((option) => option.label),
          Boolean(clarifiedScope || pendingClarificationReply),
          false
        )
      };
    }

    const scopedCandidates = requestedScope
      ? scored
          .filter(
            (candidate) =>
              this.metadataMatchesScope(candidate.knowledgeMetadata, requestedScope) &&
              this.metadataMatchesIntent(candidate.knowledgeMetadata, intent)
          )
          .map((candidate) => this.applyResolvedScopeScore(candidate))
      : scored;

    if (requestedScope && scopedCandidates.length === 0) {
      warnings.push("A product scope was available, but no READY chunks matched that scope.");
    }

    const selected = this.selectDiverseCandidates(scopedCandidates, limit);
    const answerProductContext =
      requestedScope ??
      this.resolveExplicitEvidenceProductContext(effectiveQuestion, selected, pendingClarificationReply);
    const confidence = this.evaluateConfidence(selected, answerProductContext, intent);

    if (selected.length > 0 && confidence.level === "weak" && this.shouldSuppressWeakAnswer(tokens, intent, answerProductContext, selected)) {
      warnings.push("Retrieved evidence did not meet the confidence threshold; answering without citations would be unsafe.");

      return {
        mode: "answer",
        effectiveQuestion,
        retrievedChunks: [],
        intent,
        productContext: answerProductContext,
        pendingClarification: null,
        ambiguity: {
          isAmbiguous: false,
          intent,
          productContext: answerProductContext,
          options: productGroups.slice(0, 4).map((group) => group.label)
        },
        confidence: {
          ...confidence,
          level: "none",
          reason: "Retrieved evidence was below the minimum confidence threshold."
        },
        warnings,
        turnType,
        retrievalMetadata: this.buildHybridMetadata(
          normalisedQuery,
          hybridSearch,
          [],
          confidence.bestScore ?? 0,
          limit,
          false,
          productGroups.slice(0, 4).map((group) => group.label),
          Boolean(clarifiedScope || pendingClarificationReply),
          Boolean(turnType === "follow_up" && retrievalContext.productContext)
        )
      };
    }

    this.logger.debug(
      `Retrieved ${selected.length} chunks for tenant ${tenant.slug}: ${selected
        .map((candidate) => `${candidate.chunk.knowledgeDocumentId}/${candidate.chunk.chunkIndex}:${candidate.score}`)
        .join(", ")}`
    );

    return {
      mode: "answer",
      effectiveQuestion,
      retrievedChunks: selected.map((candidate) => candidate.chunk),
      intent,
      productContext: answerProductContext,
      pendingClarification: null,
      ambiguity: {
        isAmbiguous: false,
        intent,
        productContext: answerProductContext,
        options: productGroups.slice(0, 4).map((group) => group.label)
      },
      confidence,
      warnings,
      turnType,
      retrievalMetadata: this.buildHybridMetadata(
        normalisedQuery,
        hybridSearch,
        selected,
        confidence.bestScore ?? 0,
        limit,
        false,
        productGroups.slice(0, 4).map((group) => group.label),
        Boolean(clarifiedScope || pendingClarificationReply),
        Boolean(turnType === "follow_up" && retrievalContext.productContext)
      )
    };
  }

  private async fetchKeywordCandidates(tenant: ResolvedTenant, candidateTerms: string[]) {
    return this.prisma.client.knowledgeChunk.findMany({
      where: {
        tenantId: tenant.id,
        status: KnowledgeChunkStatus.READY,
        knowledgeDocument: {
          status: KnowledgeDocumentStatus.READY
        },
        OR: [
          ...candidateTerms.map((token) => ({
            content: {
              contains: token,
              mode: "insensitive" as const
            }
          })),
          ...candidateTerms.map((token) => ({
            knowledgeDocument: {
              title: {
                contains: token,
                mode: "insensitive" as const
              }
            }
          }))
        ]
      },
      include: {
        knowledgeDocument: {
          select: {
            id: true,
            title: true,
            sourceUri: true,
            metadata: true
          }
        }
      },
      take: SEMANTIC_POOL_LIMIT
    });
  }

  private async fetchSemanticCandidatePool(tenant: ResolvedTenant) {
    return this.prisma.client.knowledgeChunk.findMany({
      where: {
        tenantId: tenant.id,
        status: KnowledgeChunkStatus.READY,
        knowledgeDocument: {
          status: KnowledgeDocumentStatus.READY
        }
      },
      include: {
        knowledgeDocument: {
          select: {
            id: true,
            title: true,
            sourceUri: true,
            metadata: true
          }
        }
      },
      take: SEMANTIC_POOL_LIMIT
    });
  }

  private async searchHybridCandidates(
    tenant: ResolvedTenant,
    query: NormalisedKnowledgeQuery,
    candidateTerms: string[]
  ): Promise<HybridSearchResult> {
    const [keywordPool, semanticPool] = await Promise.all([
      this.fetchKeywordCandidates(tenant, candidateTerms),
      this.fetchSemanticCandidatePool(tenant)
    ]);
    const normalizedQuestion = this.extractNormalizedWords(query.effectiveQuestion).join(" ");
    const keywordPoolRanked = keywordPool
      .map((candidate) => {
        const storedDocumentMetadata = this.knowledgeMetadataService.readKnowledgeMetadata(
          candidate.knowledgeDocument.metadata
        );
        const storedChunkMetadata = this.knowledgeMetadataService.readKnowledgeMetadata(candidate.metadata);

        return {
          candidate,
          score: this.scoreChunk(
            candidate.content,
            candidate.knowledgeDocument.title,
            normalizedQuestion,
            query.keywords,
            query.phrases,
            storedChunkMetadata ?? storedDocumentMetadata,
            query.intent
          )
        };
      })
      .filter(({ score }) => score.score > 0)
      .sort(
        (left, right) =>
          right.score.score - left.score.score ||
          right.score.coverage - left.score.coverage ||
          left.candidate.id.localeCompare(right.candidate.id)
      );
    const keywordRanked = keywordPoolRanked.slice(0, KEYWORD_TOP_K);
    const keywordRecords = keywordRanked.map(({ candidate }) => candidate);
    const allRawKeywordById = new Map(
      keywordPoolRanked.map(({ candidate, score }) => [candidate.id, score])
    );
    const rawKeywordById = new Map(
      keywordRanked.map(({ candidate, score }) => [candidate.id, score])
    );
    const allKeywordIds = new Set(keywordPoolRanked.map(({ candidate }) => candidate.id));
    const keywordIds = new Set(keywordRecords.map((candidate) => candidate.id));
    const semanticPoolScores = semanticPool
      .map((candidate) => ({
        candidate,
        score: this.semanticSearchService.similarity(
          query.effectiveQuestion,
          `${candidate.knowledgeDocument.title}\n${candidate.content}`
        )
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score);
    const semanticScores = semanticPoolScores.slice(0, VECTOR_TOP_K);
    const allSemanticById = new Map(
      semanticPoolScores.map(({ candidate, score }) => [candidate.id, score])
    );
    const semanticById = new Map(
      semanticScores.map(({ candidate, score }) => [candidate.id, score])
    );
    const mergedRecords = new Map(
      [...keywordRecords, ...semanticScores.map(({ candidate }) => candidate)].map((candidate) => [
        candidate.id,
        candidate
      ])
    );
    const ranked = Array.from(mergedRecords.values())
      .map((candidate) =>
        this.buildScoredCandidate(
          candidate,
          query,
          rawKeywordById.get(candidate.id) ?? { score: 0, coverage: 0 },
          semanticById.get(candidate.id) ?? 0,
          keywordIds.has(candidate.id)
        )
      )
      .filter((candidate) => candidate.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.exactMatchBoost - left.exactMatchBoost ||
          right.coverage - left.coverage ||
          left.chunk.title.localeCompare(right.chunk.title) ||
          left.chunk.chunkIndex - right.chunk.chunkIndex
      );

    const productDiscoveryRecords = new Map(
      [
        ...keywordPoolRanked.map(({ candidate }) => candidate),
        ...semanticPool
      ].map((candidate) => [candidate.id, candidate])
    );
    const productDiscoveryCandidates = Array.from(productDiscoveryRecords.values()).map(
      (candidate) =>
        this.buildScoredCandidate(
          candidate,
          query,
          allRawKeywordById.get(candidate.id) ?? { score: 0, coverage: 0 },
          allSemanticById.get(candidate.id) ?? 0,
          allKeywordIds.has(candidate.id)
        )
    );
    const intentProductGroups = this.buildProductGroups(productDiscoveryCandidates, query.intent);
    const catalogProductGroups = this.buildProductGroups(productDiscoveryCandidates);
    const productGroups =
      intentProductGroups.length >= 2 || catalogProductGroups.length < 2
        ? intentProductGroups
        : catalogProductGroups;

    return {
      ranked,
      productGroups,
      keywordCandidateChunkIds: keywordRecords.map((candidate) => candidate.id),
      vectorCandidateChunkIds: semanticScores.map(({ candidate }) => candidate.id),
      mergedCandidateChunkIds: Array.from(mergedRecords.keys())
    };
  }

  private buildScoredCandidate(
    candidate: KnowledgeCandidateRecord,
    query: NormalisedKnowledgeQuery,
    rawKeyword: { score: number; coverage: number },
    vectorScore: number,
    keywordMatched: boolean
  ): ScoredCandidate {
    const storedDocumentMetadata = this.knowledgeMetadataService.readKnowledgeMetadata(
      candidate.knowledgeDocument.metadata
    );
    const storedChunkMetadata = this.knowledgeMetadataService.readKnowledgeMetadata(candidate.metadata);
    const documentMetadata =
      storedDocumentMetadata ??
      this.knowledgeMetadataService.buildDocumentMetadata({
        title: candidate.knowledgeDocument.title,
        content: candidate.content,
        sourceUri: candidate.knowledgeDocument.sourceUri,
        currentMetadata: candidate.knowledgeDocument.metadata
      });
    const chunkMetadata =
      storedChunkMetadata ??
      this.knowledgeMetadataService.buildChunkMetadata({
        documentMetadata,
        content: candidate.content,
        sourceLocator: candidate.sourceLocator
      });
    let keywordScore = normalizeRawKeywordScore(rawKeyword.score);
    const metadataScore = normalizeMetadataScore(
      this.scoreMetadata(chunkMetadata, query.keywords, query.intent).score
    );
    const exactMatchBoost = this.scoreExactMatch(
      candidate.content,
      candidate.knowledgeDocument.title,
      query,
      chunkMetadata
    );

    if (keywordMatched && exactMatchBoost === 1) {
      keywordScore = 1;
    }

    const finalScore = roundScore(
      keywordScore * 0.45 +
        vectorScore * 0.35 +
        metadataScore * 0.15 +
        exactMatchBoost * 0.05
    );
    const reasons = [
      keywordScore > 0 ? "keyword_match" : null,
      vectorScore > 0 ? "semantic_vector_match" : null,
      metadataScore > 0 ? "metadata_match" : null,
      exactMatchBoost > 0 ? "exact_product_or_model_match" : null
    ].filter((reason): reason is string => Boolean(reason));

    return {
      score: finalScore,
      coverage: rawKeyword.coverage,
      keywordScore,
      vectorScore,
      metadataScore,
      exactMatchBoost,
      reasons,
      knowledgeMetadata: chunkMetadata,
      chunk: {
        knowledgeDocumentId: candidate.knowledgeDocument.id,
        chunkId: candidate.id,
        title: candidate.knowledgeDocument.title,
        chunkIndex: candidate.chunkIndex,
        sourceUri: candidate.knowledgeDocument.sourceUri,
        sourceLocator: candidate.sourceLocator,
        relevanceScore: finalScore,
        knowledgeMetadata: chunkMetadata,
        content: candidate.content
      }
    };
  }

  private emptyAnswerDecision(
    originalQuestion: string,
    effectiveQuestion: string,
    intent: string | undefined,
    warnings: string[],
    turnType: ConversationTurnType | undefined,
    finalTopK: number
  ): KnowledgeRetrievalDecision {
    return {
      mode: "answer",
      effectiveQuestion,
      retrievedChunks: [],
      intent,
      productContext: null,
      pendingClarification: null,
      ambiguity: {
        isAmbiguous: false,
        intent,
        productContext: null,
        options: []
      },
      confidence: {
        level: "none",
        reason: "No searchable terms or no READY knowledge chunks met the retrieval threshold."
      },
      warnings,
      turnType,
      retrievalMetadata: this.buildHybridMetadata(
        this.buildNormalisedQuery(originalQuestion, effectiveQuestion, intent),
        {
          ranked: [],
          productGroups: [],
          keywordCandidateChunkIds: [],
          vectorCandidateChunkIds: [],
          mergedCandidateChunkIds: []
        },
        [],
        0,
        finalTopK,
        false,
        [],
        false,
        false
      )
    };
  }

  private readRetrievalContext(context: unknown): KnowledgeRetrievalContext {
    if (!isPlainObject(context)) {
      return {};
    }

    const rag = isPlainObject(context.rag) ? context.rag : context;

    return {
      productContext: this.knowledgeMetadataService.readKnowledgeMetadata(rag.productContext) ?? null,
      pendingClarification: this.readPendingClarification(rag.pendingClarification)
    };
  }

  private readPendingClarification(value: unknown): RetrievalPendingClarification | null {
    if (!isPlainObject(value) || typeof value.originalQuestion !== "string" || !Array.isArray(value.options)) {
      return null;
    }

    const options = value.options.flatMap((option) => {
      if (!isPlainObject(option) || typeof option.label !== "string") {
        return [];
      }

      const knowledgeMetadata = this.knowledgeMetadataService.readKnowledgeMetadata(option.knowledgeMetadata);

      return knowledgeMetadata
        ? [{ label: option.label, knowledgeMetadata }]
        : [];
    });

    const pendingClarification: RetrievalPendingClarification = {
      originalQuestion: value.originalQuestion,
      intent: typeof value.intent === "string" ? value.intent : undefined,
      options,
      type: value.type === "PRODUCT_DISAMBIGUATION" ? "PRODUCT_DISAMBIGUATION" : undefined,
      createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
      expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : undefined
    };

    return this.conversationContextService.isPendingClarificationExpired(pendingClarification.expiresAt)
      ? null
      : pendingClarification;
  }

  private resolvePendingClarification(
    question: string,
    pendingClarification?: RetrievalPendingClarification | null
  ): (RetrievalPendingClarificationOption & { originalQuestion: string; intent?: string }) | null {
    if (!pendingClarification) {
      return null;
    }

    const normalizedQuestion = this.knowledgeMetadataService.normalizeLabel(question);
    const questionWords = new Set(normalizedQuestion.split(" ").filter(Boolean));
    let best:
      | (RetrievalPendingClarificationOption & { originalQuestion: string; intent?: string; score: number })
      | null = null;

    for (const option of pendingClarification.options) {
      const labels = this.knowledgeMetadataService.buildProductLabels(option.knowledgeMetadata);
      const score = labels.reduce(
        (sum, label) => sum + this.scoreProductLabelMatch(question, normalizedQuestion, questionWords, label, {
          requireStrongMatch: true
        }),
        0
      );

      if (!best || score > best.score) {
        best = {
          ...option,
          originalQuestion: pendingClarification.originalQuestion,
          intent: pendingClarification.intent,
          score
        };
      }
    }

    return best && best.score >= 12 ? best : null;
  }

  private resolveMentionedProductContext(
    question: string,
    candidates: ScoredCandidate[],
    options: { requireStrongMatch?: boolean } = {}
  ): KnowledgeStructuredMetadata | null {
    const normalizedQuestion = this.knowledgeMetadataService.normalizeLabel(question);
    const questionWords = new Set(normalizedQuestion.split(" ").filter(Boolean));
    let best: { score: number; metadata: KnowledgeStructuredMetadata } | null = null;

    for (const candidate of candidates) {
      if (!candidate.knowledgeMetadata) {
        continue;
      }

      const labels = this.knowledgeMetadataService.buildProductLabels(candidate.knowledgeMetadata);
      const score = labels.reduce(
        (sum, label) => sum + this.scoreProductLabelMatch(question, normalizedQuestion, questionWords, label, options),
        0
      );

      if (score > 0 && (!best || score > best.score)) {
        best = { score, metadata: candidate.knowledgeMetadata };
      }
    }

    return best && best.score >= 8 ? best.metadata : null;
  }

  private scoreProductLabelMatch(
    rawQuestion: string,
    normalizedQuestion: string,
    questionWords: Set<string>,
    label: string,
    options: { requireStrongMatch?: boolean } = {}
  ): number {
    const normalizedLabel = this.knowledgeMetadataService.normalizeLabel(label);

    if (!normalizedQuestion || !normalizedLabel) {
      return 0;
    }

    if (normalizedQuestion === normalizedLabel) {
      return 32;
    }

    if (normalizedLabel.length >= 4 && normalizedQuestion.includes(normalizedLabel)) {
      return 28;
    }

    if (this.isLikelyShortModelCode(rawQuestion) && this.isLikelyShortModelCode(label)) {
      const compactQuestion = normalizedQuestion.replace(/\s+/g, "");
      const compactLabel = normalizedLabel.replace(/\s+/g, "");
      const maximumDistance = Math.min(compactQuestion.length, compactLabel.length) >= 6 ? 2 : 1;

      if (damerauLevenshteinDistance(compactQuestion, compactLabel) <= maximumDistance) {
        return 24;
      }
    }

    const labelWords = normalizedLabel.split(" ").filter(Boolean);
    const overlap = labelWords.filter((word) => questionWords.has(word)).length;

    if (overlap >= 2) {
      return overlap * 8;
    }

    if (!options.requireStrongMatch && labelWords.length === 1 && overlap === 1) {
      return 8;
    }

    return 0;
  }

  private buildProductGroups(candidates: ScoredCandidate[], intent?: string): ProductGroup[] {
    const groups = new Map<string, { label: string; score: number; knowledgeMetadata: KnowledgeStructuredMetadata }>();

    for (const candidate of candidates) {
      if (!candidate.knowledgeMetadata) {
        continue;
      }

      if (intent && candidate.knowledgeMetadata.intentHints?.length) {
        const hints = candidate.knowledgeMetadata.intentHints.map((hint) => this.knowledgeMetadataService.normalizeLabel(hint));

        if (!hints.includes(intent)) {
          continue;
        }
      }

      const labels = this.knowledgeMetadataService
        .buildProductLabels(candidate.knowledgeMetadata)
        .filter((label) => this.isCandidateProductLabel(label, candidate));
      const label = labels[0];

      if (!label) {
        continue;
      }

      const key = this.knowledgeMetadataService.normalizeLabel(label);
      const existing = groups.get(key);
      const score = candidate.score;

      if (!existing || score > existing.score) {
        groups.set(key, {
          label,
          score,
          knowledgeMetadata: candidate.knowledgeMetadata
        });
      }
    }

    return Array.from(groups.values()).sort(
      (left, right) => right.score - left.score || left.label.localeCompare(right.label)
    );
  }

  private shouldAskClarification(
    tokens: string[],
    intent: string | undefined,
    productGroups: Array<{ label: string; score: number }>
  ): boolean {
    if (!intent || !PRODUCT_CLARIFICATION_INTENTS.has(intent) || productGroups.length < 2) {
      return false;
    }

    const nonIntentTokens = tokens.filter((token) => !this.isIntentToken(token, intent));

    if (nonIntentTokens.length > 1) {
      return false;
    }

    const first = productGroups[0];
    const second = productGroups[1];

    if (!first || !second) {
      return false;
    }

    return first.score - second.score <= 0.12;
  }

  private shouldAskOpenProductClarification(
    tokens: string[],
    intent: string | undefined,
    productGroups: Array<{ label: string; score: number }>,
    candidates: ScoredCandidate[],
    pendingClarificationReply: boolean
  ): boolean {
    if (!intent || !PRODUCT_CLARIFICATION_INTENTS.has(intent) || candidates.length === 0) {
      return false;
    }

    const nonIntentTokens = tokens.filter((token) => !this.isIntentToken(token, intent));

    if (pendingClarificationReply) {
      return (
        nonIntentTokens.length === 0 ||
        nonIntentTokens.every((token) => GENERIC_MODEL_TERMS.has(this.knowledgeMetadataService.normalizeLabel(token)))
      );
    }

    if (productGroups.length === 1) {
      return false;
    }

    return nonIntentTokens.length <= 1;
  }

  private shouldRepeatPendingClarification(
    question: string,
    pendingClarification: RetrievalPendingClarification,
    intent: string | undefined,
    tokens: string[]
  ): boolean {
    if (intent && pendingClarification.intent && intent !== pendingClarification.intent) {
      return false;
    }

    const normalizedQuestion = this.knowledgeMetadataService.normalizeLabel(question);

    if (!normalizedQuestion) {
      return false;
    }

    if (tokens.length <= 3) {
      return true;
    }

    return Boolean(intent && pendingClarification.intent === intent);
  }

  private shouldTreatAsPendingClarificationReply(
    question: string,
    pendingClarification: RetrievalPendingClarification
  ): boolean {
    const normalizedQuestion = this.knowledgeMetadataService.normalizeLabel(question);

    if (!normalizedQuestion) {
      return false;
    }

    const detectedIntent = this.detectIntent(question);

    if (detectedIntent && pendingClarification.intent && detectedIntent !== pendingClarification.intent) {
      return false;
    }

    const words = normalizedQuestion.split(" ").filter(Boolean);

    return words.length <= 3 || this.isLikelyShortModelCode(question);
  }

  private evaluateConfidence(
    selected: ScoredCandidate[],
    requestedScope: KnowledgeStructuredMetadata | null,
    intent?: string
  ): KnowledgeRetrievalConfidence {
    const best = selected[0];

    if (!best) {
      return {
        level: "none",
        reason: "No READY knowledge chunks met the retrieval threshold."
      };
    }

    const second = selected[1];
    const scoreGap = second ? best.score - second.score : undefined;
    const hasProductScope = Boolean(requestedScope);
    const hasIntentMatch = Boolean(
      intent &&
        best.knowledgeMetadata?.intentHints
          ?.map((hint) => this.knowledgeMetadataService.normalizeLabel(hint))
          .includes(intent)
    );
    const strongByScope = hasProductScope && best.score >= 0.68;
    const strongByEvidence = best.score >= STRONG_CONFIDENCE_THRESHOLD;
    const strongByIntent = hasIntentMatch && best.score >= 0.68 && best.coverage >= 0.5;

    if (strongByScope || strongByEvidence || strongByIntent) {
      return {
        level: "strong",
        reason: hasProductScope
          ? "Retrieved evidence matched the resolved product scope."
          : "Retrieved evidence met the score and coverage threshold.",
        bestScore: best.score,
        bestCoverage: best.coverage,
        scoreGap
      };
    }

    return {
      level: "weak",
      reason: "Retrieved evidence is available, but score, coverage, or product scope is weak.",
      bestScore: best.score,
      bestCoverage: best.coverage,
      scoreGap
    };
  }

  private shouldSuppressWeakAnswer(
    tokens: string[],
    intent: string | undefined,
    requestedScope: KnowledgeStructuredMetadata | null,
    selected: ScoredCandidate[]
  ): boolean {
    const best = selected[0];

    if (!best) {
      return false;
    }

    if (best.score < NO_EVIDENCE_THRESHOLD) {
      return true;
    }

    if (requestedScope) {
      return false;
    }

    if (tokens.length >= 2 && best.coverage < 0.34) {
      return true;
    }

    return Boolean(intent && !requestedScope && best.score < 0.62);
  }

  private isCandidateProductLabel(label: string, candidate: ScoredCandidate): boolean {
    const normalizedLabel = this.knowledgeMetadataService.normalizeLabel(label);
    const isStructuredFileTitle = /\.(?:csv|xlsx?|json|txt|md|markdown)$/i.test(candidate.chunk.title.trim());
    const normalizedTitle = this.knowledgeMetadataService.normalizeLabel(
      candidate.chunk.title.replace(/\.(?:csv|xlsx?|json|txt|md|markdown)$/i, "")
    );

    if (normalizedLabel !== normalizedTitle) {
      return true;
    }

    if (isStructuredFileTitle && !SHORT_MODEL_CODE_PATTERN.test(label.trim().toUpperCase())) {
      return false;
    }

    return PRODUCT_ENTITY_SIGNAL_PATTERN.test(label) || SHORT_MODEL_CODE_PATTERN.test(label.trim());
  }

  private isLikelyShortModelCode(value: string): boolean {
    const trimmed = value.trim();
    const normalized = this.knowledgeMetadataService.normalizeLabel(trimmed).replace(/\s+/g, "");
    const uppercaseCount = (trimmed.match(/[A-Z]/g) ?? []).length;

    return (
      SHORT_MODEL_CODE_PATTERN.test(trimmed.toUpperCase()) &&
      !GENERIC_MODEL_TERMS.has(normalized) &&
      (/\d/.test(trimmed) || uppercaseCount >= 3)
    );
  }

  private buildClarificationQuestion(intent: string | undefined, labels: string[]): string {
    const action = intent ? this.intentToAction(intent) : "ask about";
    const examples = labels.length > 0 ? ` For example: ${formatEnglishList(labels)}.` : "";

    return `Which product are you trying to ${action}?${examples}`;
  }

  private intentToAction(intent: string): string {
    switch (intent) {
      case "pairing":
        return "pair";
      case "reset":
        return "reset";
      case "installation":
        return "install";
      case "warranty":
        return "check warranty coverage for";
      case "pricing":
        return "check pricing for";
      case "compatibility":
        return "check compatibility for";
      case "troubleshooting":
        return "troubleshoot";
      default:
        return "ask about";
    }
  }

  private metadataMatchesScope(
    candidateMetadata: KnowledgeStructuredMetadata | null,
    scope: KnowledgeStructuredMetadata
  ): boolean {
    if (!candidateMetadata) {
      return false;
    }

    const candidateLabels = this.knowledgeMetadataService
      .buildProductLabels(candidateMetadata)
      .map((label) => this.knowledgeMetadataService.normalizeLabel(label));
    const scopeLabels = this.knowledgeMetadataService
      .buildProductLabels(scope)
      .map((label) => this.knowledgeMetadataService.normalizeLabel(label));

    return scopeLabels.some((scopeLabel) =>
      candidateLabels.some(
        (candidateLabel) =>
          candidateLabel === scopeLabel ||
          candidateLabel.includes(scopeLabel) ||
          scopeLabel.includes(candidateLabel)
      )
    );
  }

  private metadataMatchesIntent(
    candidateMetadata: KnowledgeStructuredMetadata | null,
    intent?: string
  ): boolean {
    if (!intent || !candidateMetadata?.intentHints?.length) {
      return true;
    }

    return candidateMetadata.intentHints.some(
      (hint) => this.knowledgeMetadataService.normalizeLabel(hint) === intent
    );
  }

  private applyResolvedScopeScore(candidate: ScoredCandidate): ScoredCandidate {
    const score = roundScore(candidate.score + (1 - candidate.metadataScore) * 0.15);

    return {
      ...candidate,
      score,
      metadataScore: 1,
      reasons: Array.from(new Set([...candidate.reasons, "resolved_product_scope"])),
      chunk: {
        ...candidate.chunk,
        relevanceScore: score
      }
    };
  }

  private resolveExplicitEvidenceProductContext(
    effectiveQuestion: string,
    selected: ScoredCandidate[],
    pendingClarificationReply: boolean
  ): KnowledgeStructuredMetadata | null {
    const mentioned = this.resolveMentionedProductContext(effectiveQuestion, selected, {
      requireStrongMatch: true
    });

    if (mentioned) {
      return mentioned;
    }

    if (!pendingClarificationReply) {
      return null;
    }

    const selectedMetadata = selected
      .map((candidate) => candidate.knowledgeMetadata)
      .filter((metadata): metadata is KnowledgeStructuredMetadata => Boolean(metadata));

    if (selectedMetadata.length === 0) {
      return null;
    }

    const [first] = selectedMetadata;

    if (!first) {
      return null;
    }

    return selectedMetadata.every((metadata) => this.metadataMatchesScope(metadata, first))
      ? first
      : null;
  }

  private buildNormalisedQuery(
    originalQuestion: string,
    effectiveQuestion: string,
    intent?: string,
    productContext?: KnowledgeStructuredMetadata | null
  ): NormalisedKnowledgeQuery {
    const contextLabels = this.knowledgeMetadataService.buildProductLabels(productContext).slice(0, 4);
    const searchText = contextLabels.length > 0
      ? `${effectiveQuestion} ${contextLabels.join(" ")}`
      : effectiveQuestion;
    const shortModelVariants = this.extractShortModelLookupVariants(searchText);
    const keywords = Array.from(
      new Set([
        ...this.extractSearchTerms(searchText),
        ...shortModelVariants.map((model) => this.knowledgeMetadataService.normalizeLabel(model))
      ])
    );
    const synonyms = Array.from(
      new Set(keywords.flatMap((keyword) => this.expandToken(keyword)).filter((term) => !keywords.includes(term)))
    );
    const modelNumbers = Array.from(
      new Set(
        [
          ...(searchText.match(/\b(?:[A-Z]{2,}[A-Z0-9-]*\d[A-Z0-9-]*|\d{2,4}W)\b/gi) ?? []),
          ...shortModelVariants
        ]
      )
    );
    const productNames = keywords
      .filter((keyword) => !this.isIntentToken(keyword, intent ?? ""))
      .filter((keyword) => !modelNumbers.some((model) => this.normalizeTerm(model.toLowerCase()) === keyword))
      .slice(0, 6);

    return {
      originalQuestion,
      effectiveQuestion,
      keywords,
      phrases: this.extractSearchPhrases(searchText),
      modelNumbers,
      productNames,
      synonyms,
      intent
    };
  }

  private scoreExactMatch(
    content: string,
    title: string,
    query: NormalisedKnowledgeQuery,
    metadata: KnowledgeStructuredMetadata | null
  ): number {
    const normalizedTitle = this.knowledgeMetadataService.normalizeLabel(title);
    const haystack = this.knowledgeMetadataService.normalizeLabel(`${title} ${content}`);
    const normalizedQuestion = this.knowledgeMetadataService.normalizeLabel(query.effectiveQuestion);

    if (normalizedTitle === normalizedQuestion) {
      return 1;
    }

    if (
      metadata &&
      this.knowledgeMetadataService
        .buildProductLabels(metadata)
        .some((label) => {
          const normalizedLabel = this.knowledgeMetadataService.normalizeLabel(label);

          return normalizedLabel.length >= 4 && normalizedQuestion.includes(normalizedLabel);
        })
    ) {
      return 1;
    }

    const titleTerms = new Set(this.extractNormalizedWords(title));

    if (query.keywords.length > 0 && query.keywords.every((keyword) => titleTerms.has(keyword))) {
      return 1;
    }

    if (
      query.keywords.some((keyword) =>
        this.expandToken(keyword).some((equivalent) => titleTerms.has(equivalent))
      )
    ) {
      return 1;
    }

    if (
      query.modelNumbers.some((modelNumber) =>
        haystack.includes(this.knowledgeMetadataService.normalizeLabel(modelNumber))
      )
    ) {
      return 1;
    }

    if (normalizedQuestion.length >= 12 && haystack.includes(normalizedQuestion)) {
      return 1;
    }

    return query.phrases.some((phrase) => phrase.length >= 8 && haystack.includes(phrase)) ? 0.6 : 0;
  }

  private buildHybridMetadata(
    query: NormalisedKnowledgeQuery,
    search: HybridSearchResult,
    selected: ScoredCandidate[],
    confidence: number,
    finalTopK: number,
    ambiguityDetected: boolean,
    candidateProductNames: string[],
    usedPendingClarification: boolean,
    usedProductContext: boolean
  ): HybridRetrievalMetadata {
    const selectedById = new Map(
      selected.map((candidate) => [candidate.chunk.chunkId, candidate])
    );

    return {
      retrievalMode: "HYBRID",
      originalQuestion: query.originalQuestion,
      effectiveQuestion: query.effectiveQuestion,
      intent: query.intent,
      usedPendingClarification,
      usedProductContext,
      keywordTopK: KEYWORD_TOP_K,
      vectorTopK: VECTOR_TOP_K,
      finalTopK,
      keywordCandidateChunkIds: search.keywordCandidateChunkIds,
      vectorCandidateChunkIds: search.vectorCandidateChunkIds,
      mergedCandidateChunkIds: search.mergedCandidateChunkIds,
      selectedChunkIds: selected.map((candidate) => candidate.chunk.chunkId),
      scores: search.ranked.slice(0, KEYWORD_TOP_K + VECTOR_TOP_K).map((candidate) => {
        const effectiveCandidate = selectedById.get(candidate.chunk.chunkId) ?? candidate;

        return {
          chunkId: effectiveCandidate.chunk.chunkId,
          keywordScore: effectiveCandidate.keywordScore,
          vectorScore: effectiveCandidate.vectorScore,
          metadataScore: effectiveCandidate.metadataScore,
          exactMatchBoost: effectiveCandidate.exactMatchBoost,
          finalScore: effectiveCandidate.score,
          reasons: effectiveCandidate.reasons
        };
      }),
      confidence: roundScore(confidence),
      noKnowledgeEvidence: selected.length === 0,
      ambiguity: {
        detected: ambiguityDetected,
        candidateProductNames
      }
    };
  }

  private detectIntent(question: string): string | undefined {
    const normalizedQuestion = this.knowledgeMetadataService.normalizeLabel(question);
    const paddedQuestion = ` ${normalizedQuestion} `;

    for (const [intent, terms] of Object.entries(INTENT_TERMS)) {
      if (
        terms.some((term) => {
          const normalizedTerm = this.knowledgeMetadataService.normalizeLabel(term);

          return normalizedTerm.length > 0 && paddedQuestion.includes(` ${normalizedTerm} `);
        })
      ) {
        return intent;
      }
    }

    return undefined;
  }

  private isIntentToken(token: string, intent: string): boolean {
    const normalizedToken = this.knowledgeMetadataService.normalizeLabel(token);

    return (INTENT_TERMS[intent] ?? []).some(
      (term) => this.knowledgeMetadataService.normalizeLabel(term) === normalizedToken
    );
  }

  private extractSearchTerms(question: string): string[] {
    const terms = this.extractNormalizedWords(question).filter((term) => !STOP_WORDS.has(term));

    return Array.from(new Set(terms)).slice(0, 8);
  }

  private extractCandidateSearchTerms(question: string): string[] {
    const rawTerms = this.extractRawWords(question).filter((term) => !STOP_WORDS.has(this.normalizeTerm(term)));
    const normalizedTerms = rawTerms.map((term) => this.normalizeTerm(term));

    return this.expandTerms([...rawTerms, ...normalizedTerms]).slice(0, 32);
  }

  private extractShortModelLookupVariants(question: string): string[] {
    const modelCodes = (question.match(/\b[A-Za-z0-9-]{4,16}\b/g) ?? []).filter((term) =>
      this.isLikelyShortModelCode(term)
    );
    const variants = new Set<string>();

    for (const modelCode of modelCodes) {
      const uppercase = modelCode.toUpperCase();
      variants.add(uppercase);

      for (let index = 0; index < uppercase.length - 1; index += 1) {
        const characters = [...uppercase];
        [characters[index], characters[index + 1]] = [characters[index + 1]!, characters[index]!];
        variants.add(characters.join(""));
      }
    }

    return Array.from(variants).slice(0, 24);
  }

  private extractSearchPhrases(question: string): string[] {
    const words = this.extractNormalizedWords(question).filter((word) => !STOP_WORDS.has(word));
    const normalized = words.join(" ");

    if (!normalized) {
      return [];
    }

    const phrases: string[] = [];

    for (let index = 0; index < words.length - 1; index += 1) {
      phrases.push(`${words[index]} ${words[index + 1]}`);
    }

    return phrases.slice(0, 4);
  }

  private scoreChunk(
    content: string,
    title: string,
    question: string,
    tokens: string[],
    phrases: string[],
    metadata: KnowledgeStructuredMetadata | null,
    intent?: string
  ): { score: number; coverage: number } {
    const contentTerms = this.extractNormalizedWords(content);
    const titleTerms = this.extractNormalizedWords(title);
    const normalizedContent = contentTerms.join(" ");
    let score = 0;
    let matchedTokens = 0;

    if (question.length > 8 && normalizedContent.includes(question)) {
      score += 16;
    }

    for (const phrase of phrases) {
      if (normalizedContent.includes(phrase)) {
        score += 8;
      }
    }

    for (const token of tokens) {
      const equivalentTerms = this.expandToken(token);
      const contentOccurrences = equivalentTerms.reduce(
        (sum, term) => sum + this.countOccurrences(contentTerms, term),
        0
      );
      const titleOccurrences = equivalentTerms.reduce(
        (sum, term) => sum + this.countOccurrences(titleTerms, term),
        0
      );

      if (contentOccurrences > 0) {
        matchedTokens += 1;
        score += 4 + Math.min(contentOccurrences, 4);
      }

      if (titleOccurrences > 0) {
        if (contentOccurrences === 0) {
          matchedTokens += 1;
        }

        score += 4;
      }
    }

    if (matchedTokens >= 2) {
      score += matchedTokens * 2;
    }

    if (metadata) {
      const metadataScore = this.scoreMetadata(metadata, tokens, intent);
      score += metadataScore.score;
      matchedTokens += metadataScore.matchedTokens;
    }

    const coverage = tokens.length > 0 ? Math.min(matchedTokens, tokens.length) / tokens.length : 0;

    return { score, coverage };
  }

  private scoreMetadata(
    metadata: KnowledgeStructuredMetadata,
    tokens: string[],
    intent?: string
  ): { score: number; matchedTokens: number } {
    const labels = this.knowledgeMetadataService.buildProductLabels(metadata);
    const labelWords = labels.flatMap((label) =>
      this.knowledgeMetadataService.normalizeLabel(label).split(" ").filter(Boolean)
    );
    const labelWordSet = new Set(labelWords);
    let score = 0;
    let matchedTokens = 0;

    for (const token of tokens) {
      if (labelWordSet.has(token)) {
        score += 10;
        matchedTokens += 1;
      }
    }

    if (intent && metadata.intentHints?.map((hint) => this.knowledgeMetadataService.normalizeLabel(hint)).includes(intent)) {
      score += 6;
    }

    return { score, matchedTokens };
  }

  private extractNormalizedWords(content: string): string[] {
    return this.extractRawWords(content)
      .map((term) => this.normalizeTerm(term))
      .filter((term) => term.length >= 3);
  }

  private extractRawWords(content: string): string[] {
    return content
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3);
  }

  private normalizeTerm(term: string): string {
    if (term.length > 4 && term.endsWith("ies")) {
      return `${term.slice(0, -3)}y`;
    }

    if (term.length > 4 && /(ses|xes|zes|ches|shes)$/.test(term)) {
      return term.slice(0, -2);
    }

    if (term.length > 3 && term.endsWith("s") && !term.endsWith("ss")) {
      return term.slice(0, -1);
    }

    return term;
  }

  private countOccurrences(terms: string[], token: string): number {
    return terms.filter((term) => term === token).length;
  }

  private expandTerms(terms: string[]): string[] {
    const expanded = new Set<string>();

    for (const term of terms) {
      const rawTerm = term.toLowerCase();

      if (rawTerm && !STOP_WORDS.has(this.normalizeTerm(rawTerm))) {
        expanded.add(rawTerm);
      }

      for (const expandedTerm of this.expandToken(term)) {
        expanded.add(expandedTerm);
      }
    }

    return Array.from(expanded);
  }

  private expandToken(term: string): string[] {
    const normalized = this.normalizeTerm(term);

    if (!normalized || STOP_WORDS.has(normalized)) {
      return [];
    }

    return Array.from(
      new Set([
        normalized,
        ...(SUPPORT_SYNONYMS[normalized] ?? []).map((synonym) => this.normalizeTerm(synonym))
      ])
    );
  }

  private selectDiverseCandidates(candidates: ScoredCandidate[], limit: number): ScoredCandidate[] {
    const selected: ScoredCandidate[] = [];
    const perDocumentCount = new Map<string, number>();

    for (const candidate of candidates) {
      const count = perDocumentCount.get(candidate.chunk.knowledgeDocumentId) ?? 0;

      if (count >= 2 && candidates.some(
        (other) =>
          other.chunk.knowledgeDocumentId !== candidate.chunk.knowledgeDocumentId &&
          !selected.some((selectedCandidate) => selectedCandidate.chunk.chunkId === other.chunk.chunkId)
      )) {
        continue;
      }

      selected.push(candidate);
      perDocumentCount.set(candidate.chunk.knowledgeDocumentId, count + 1);

      if (selected.length >= limit) {
        break;
      }
    }

    return selected;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeRawKeywordScore(score: number): number {
  return roundScore(1 - Math.exp(-Math.max(0, score) / 5.5));
}

function normalizeMetadataScore(score: number): number {
  return roundScore(Math.min(Math.max(score, 0) / 16, 1));
}

function roundScore(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 10_000) / 10_000;
}

function formatEnglishList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} or ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, or ${values[values.length - 1]}`;
}

function damerauLevenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  let previousPrevious = Array.from({ length: right.length + 1 }, () => 0);
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (previous[rightIndex] ?? 0) + 1,
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + substitutionCost
      );

      if (
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        current[rightIndex] = Math.min(
          current[rightIndex] ?? Number.POSITIVE_INFINITY,
          (previousPrevious[rightIndex - 2] ?? 0) + 1
        );
      }
    }

    previousPrevious = previous;
    previous = current;
    current = Array.from({ length: right.length + 1 }, () => 0);
  }

  return previous[right.length] ?? Number.POSITIVE_INFINITY;
}
