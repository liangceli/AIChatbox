import { Injectable } from "@nestjs/common";

export type ConversationTurnType =
  | "acknowledgement"
  | "clarification_reply"
  | "follow_up"
  | "greeting"
  | "human_request"
  | "new_question"
  | "social"
  | "thanks";

interface TurnContext {
  detectedIntent?: string;
  pendingIntent?: string;
  hasPendingClarification: boolean;
  hasProductContext: boolean;
}

type ConversationResponseTurn = Extract<
  ConversationTurnType,
  "acknowledgement" | "greeting" | "social" | "thanks"
>;

interface ConversationRoutingOverrides {
  acknowledgementPhrases?: string[];
  followUpPhrases?: string[];
  greetingPhrases?: string[];
  humanRequestPhrases?: string[];
  socialPhrases?: string[];
  thanksPhrases?: string[];
  responses?: Partial<Record<ConversationResponseTurn, string>>;
}

export interface ConversationRoutingPolicy {
  acknowledgementPhrases: Set<string>;
  followUpPhrases: Set<string>;
  greetingPhrases: Set<string>;
  humanRequestPhrases: Set<string>;
  socialPhrases: Set<string>;
  thanksPhrases: Set<string>;
  responses: Partial<Record<ConversationResponseTurn, string>>;
}

// These are platform-level dialogue categories, not product or tenant content.
// Tenant operators can extend them through AgentConfig.metadata.conversationRouting.
const DEFAULT_ROUTING_OVERRIDES: Required<
  Omit<ConversationRoutingOverrides, "responses">
> = {
  acknowledgementPhrases: ["alright", "got it", "okay", "ok", "understood"],
  followUpPhrases: [
    "and",
    "also",
    "can it",
    "does it",
    "how about",
    "is it",
    "same device",
    "same product",
    "that",
    "the device",
    "the product",
    "these",
    "they",
    "this",
    "those",
    "what about",
    "what if",
    "will it"
  ],
  greetingPhrases: ["gday", "good afternoon", "good evening", "good morning", "hello", "hey", "hi", "hiya"],
  humanRequestPhrases: [
    "agent",
    "customer service",
    "human",
    "person",
    "representative",
    "someone",
    "speak to",
    "support team",
    "talk to"
  ],
  socialPhrases: [
    "how are things",
    "how are you",
    "how is everything",
    "how is going",
    "how is it going",
    "what is up",
    "whats up"
  ],
  thanksPhrases: ["appreciate it", "cheers", "ok thanks", "thank you", "thanks", "thanks a lot"]
};

const QUESTION_OPENING_PATTERN =
  /^(can|could|do|does|how|is|should|tell|what|when|where|which|who|why|will|would)\b/i;

@Injectable()
export class ConversationContextService {
  classifyTurn(message: string, context: TurnContext, rawPolicy?: unknown): ConversationTurnType {
    const normalized = normalize(message);
    const policy = this.resolveRoutingPolicy(rawPolicy);

    if (hasExactPhrase(policy.greetingPhrases, normalized)) {
      return "greeting";
    }

    if (hasSocialPhrase(policy.socialPhrases, policy.greetingPhrases, normalized)) {
      return "social";
    }

    const composedTurn = detectConversationalComposition(policy, normalized);

    if (composedTurn) {
      return composedTurn;
    }

    if (hasExactPhrase(policy.thanksPhrases, normalized)) {
      return "thanks";
    }

    if (hasExactPhrase(policy.acknowledgementPhrases, normalized)) {
      return "acknowledgement";
    }

    if (hasContainedPhrase(policy.humanRequestPhrases, normalized)) {
      return "human_request";
    }

    if (context.hasPendingClarification) {
      if (
        context.detectedIntent &&
        context.pendingIntent &&
        context.detectedIntent !== context.pendingIntent
      ) {
        return "new_question";
      }

      const wordCount = normalized.split(" ").filter(Boolean).length;
      const looksLikeNewQuestion = wordCount >= 4 && QUESTION_OPENING_PATTERN.test(normalized);

      return looksLikeNewQuestion ? "new_question" : "clarification_reply";
    }

    if (context.hasProductContext) {
      if (hasContainedPhrase(policy.followUpPhrases, normalized)) {
        return "follow_up";
      }

      const wordCount = normalized.split(" ").filter(Boolean).length;

      if (context.detectedIntent && wordCount <= 5) {
        return "follow_up";
      }
    }

    return "new_question";
  }

  resolveRoutingPolicy(rawPolicy?: unknown): ConversationRoutingPolicy {
    const rawRecord = toRecord(rawPolicy);
    const configured = toRecord(rawRecord.conversationRouting);
    const configuredResponses = toRecord(configured.responses);

    return {
      acknowledgementPhrases: mergePhraseSets(
        DEFAULT_ROUTING_OVERRIDES.acknowledgementPhrases,
        configured.acknowledgementPhrases
      ),
      followUpPhrases: mergePhraseSets(
        DEFAULT_ROUTING_OVERRIDES.followUpPhrases,
        configured.followUpPhrases
      ),
      greetingPhrases: mergePhraseSets(DEFAULT_ROUTING_OVERRIDES.greetingPhrases, configured.greetingPhrases),
      humanRequestPhrases: mergePhraseSets(
        DEFAULT_ROUTING_OVERRIDES.humanRequestPhrases,
        configured.humanRequestPhrases
      ),
      socialPhrases: mergePhraseSets(DEFAULT_ROUTING_OVERRIDES.socialPhrases, configured.socialPhrases),
      thanksPhrases: mergePhraseSets(DEFAULT_ROUTING_OVERRIDES.thanksPhrases, configured.thanksPhrases),
      responses: {
        acknowledgement: readNonEmptyString(configuredResponses.acknowledgement),
        greeting: readNonEmptyString(configuredResponses.greeting),
        social: readNonEmptyString(configuredResponses.social),
        thanks: readNonEmptyString(configuredResponses.thanks)
      }
    };
  }

  getConversationResponse(
    turnType: ConversationTurnType,
    rawPolicy?: unknown
  ): string | undefined {
    if (!isConversationalTurn(turnType)) {
      return undefined;
    }

    return this.resolveRoutingPolicy(rawPolicy).responses[turnType];
  }

  isPendingClarificationExpired(expiresAt?: string): boolean {
    if (!expiresAt) {
      return false;
    }

    const expiresAtMs = Date.parse(expiresAt);

    return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
  }
}

export function isConversationalTurn(turnType?: ConversationTurnType): turnType is ConversationResponseTurn {
  return (
    turnType === "acknowledgement" ||
    turnType === "greeting" ||
    turnType === "social" ||
    turnType === "thanks"
  );
}

function mergePhraseSets(defaultPhrases: string[], configuredValue: unknown): Set<string> {
  return new Set([
    ...defaultPhrases.map(normalize),
    ...readStringArray(configuredValue).map(normalize)
  ].filter(Boolean));
}

function hasExactPhrase(phrases: Set<string>, normalizedMessage: string): boolean {
  return phrases.has(normalizedMessage);
}

function hasSocialPhrase(
  socialPhrases: Set<string>,
  greetingPhrases: Set<string>,
  normalizedMessage: string
): boolean {
  if (socialPhrases.has(normalizedMessage)) {
    return true;
  }

  return Array.from(greetingPhrases).some((greeting) => {
    const prefix = `${greeting} `;

    return normalizedMessage.startsWith(prefix) && socialPhrases.has(normalizedMessage.slice(prefix.length));
  });
}

function hasContainedPhrase(phrases: Set<string>, normalizedMessage: string): boolean {
  const paddedMessage = ` ${normalizedMessage} `;

  return Array.from(phrases).some((phrase) => paddedMessage.includes(` ${phrase} `));
}

function detectConversationalComposition(
  policy: ConversationRoutingPolicy,
  normalizedMessage: string
): ConversationResponseTurn | null {
  const compactMessage = normalizedMessage.replace(/\s+/g, "");

  if (!compactMessage) {
    return null;
  }

  const phrases = [
    ...Array.from(policy.greetingPhrases, (phrase) => ({ turnType: "greeting" as const, phrase })),
    ...Array.from(policy.socialPhrases, (phrase) => ({ turnType: "social" as const, phrase })),
    ...Array.from(policy.thanksPhrases, (phrase) => ({ turnType: "thanks" as const, phrase })),
    ...Array.from(policy.acknowledgementPhrases, (phrase) => ({ turnType: "acknowledgement" as const, phrase }))
  ].map(({ turnType, phrase }) => ({
    turnType,
    compactPhrase: phrase.replace(/\s+/g, "")
  }));
  const reachable = Array.from({ length: compactMessage.length + 1 }, () => new Set<ConversationResponseTurn>());
  const initialTurns = reachable[0];

  if (!initialTurns) {
    return null;
  }

  initialTurns.add("greeting");

  for (let offset = 0; offset < compactMessage.length; offset += 1) {
    const currentTurns = reachable[offset];

    if (!currentTurns || currentTurns.size === 0) {
      continue;
    }

    for (const candidate of phrases) {
      if (!compactMessage.startsWith(candidate.compactPhrase, offset)) {
        continue;
      }

      const nextTurns = reachable[offset + candidate.compactPhrase.length];

      if (!nextTurns) {
        continue;
      }

      for (const turnType of currentTurns) {
        nextTurns.add(turnType);
        nextTurns.add(candidate.turnType);
      }
    }
  }

  const completedTurns = reachable[compactMessage.length] ?? new Set<ConversationResponseTurn>();

  if (completedTurns.has("social")) {
    return "social";
  }

  if (completedTurns.has("thanks")) {
    return "thanks";
  }

  if (completedTurns.has("acknowledgement")) {
    return "acknowledgement";
  }

  return completedTurns.has("greeting") ? "greeting" : null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z]+)(?:'|’|&#39;)s\b/g, "$1 is")
    .replace(/([a-z])['’]([a-z])/g, "$1$2")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
