import { Injectable } from "@nestjs/common";

export type ConversationTurnType =
  | "clarification_reply"
  | "follow_up"
  | "greeting"
  | "human_request"
  | "new_question"
  | "thanks";

interface TurnContext {
  detectedIntent?: string;
  pendingIntent?: string;
  hasPendingClarification: boolean;
  hasProductContext: boolean;
}

const GREETINGS = new Set([
  "good afternoon",
  "good evening",
  "good morning",
  "hello",
  "hello there",
  "hey",
  "hi",
  "hi there",
  "hiya"
]);

const THANKS = new Set(["appreciate it", "cheers", "ok thanks", "thank you", "thanks", "thanks a lot"]);
const HUMAN_REQUEST_PATTERN =
  /\b(agent|human|person|representative|someone|support team|customer service|talk to|speak to)\b/i;
const FOLLOW_UP_PATTERN =
  /\b(it|its|that|this|they|them|those|these|the product|the device|same product|same device)\b|^(and|also|what about|how about|does it|is it|can it|will it|what if)\b/i;
const QUESTION_OPENING_PATTERN =
  /^(can|could|do|does|how|is|should|tell|what|when|where|which|who|why|will|would)\b/i;

@Injectable()
export class ConversationContextService {
  classifyTurn(message: string, context: TurnContext): ConversationTurnType {
    const normalized = normalize(message);

    if (GREETINGS.has(normalized)) {
      return "greeting";
    }

    if (THANKS.has(normalized)) {
      return "thanks";
    }

    if (HUMAN_REQUEST_PATTERN.test(message)) {
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
      if (FOLLOW_UP_PATTERN.test(normalized)) {
        return "follow_up";
      }

      const wordCount = normalized.split(" ").filter(Boolean).length;

      if (context.detectedIntent && wordCount <= 5) {
        return "follow_up";
      }
    }

    return "new_question";
  }

  isPendingClarificationExpired(expiresAt?: string): boolean {
    if (!expiresAt) {
      return false;
    }

    const expiresAtMs = Date.parse(expiresAt);

    return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
