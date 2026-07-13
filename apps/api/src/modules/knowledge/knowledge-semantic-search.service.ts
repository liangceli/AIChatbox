import { Injectable } from "@nestjs/common";

const SEMANTIC_EQUIVALENTS: Record<string, string[]> = {
  coastal: ["marine", "salt", "corrosion", "seaside"],
  dim: ["dimmer", "dimming", "dimmable", "brightness"],
  dimmer: ["dim", "dimming", "dimmable", "brightness"],
  dimming: ["dim", "dimmer", "dimmable", "brightness"],
  exterior: ["outdoor", "outside", "weatherproof"],
  marine: ["coastal", "salt", "corrosion", "seaside"],
  outdoor: ["outside", "exterior", "weatherproof"],
  outside: ["outdoor", "exterior", "weatherproof"],
  pair: ["connect", "setup", "commission"],
  pairing: ["pair", "connect", "setup", "commission"],
  refund: ["return", "exchange"],
  return: ["refund", "exchange"],
  suitable: ["compatible", "support", "rated"],
  wet: ["water", "waterproof", "damp", "bathroom", "ip"],
  waterproof: ["wet", "water", "damp", "weatherproof", "ip"]
};

/**
 * Dependency-free semantic scorer for the local alpha runtime. It builds sparse
 * feature vectors from normalized terms, phrases, and domain-neutral support
 * equivalents. A persisted neural embedding provider can replace this service
 * without changing retrieval orchestration.
 */
@Injectable()
export class KnowledgeSemanticSearchService {
  similarity(query: string, candidate: string): number {
    const queryVector = this.buildVector(query);
    const candidateVector = this.buildVector(candidate);

    if (queryVector.size === 0 || candidateVector.size === 0) {
      return 0;
    }

    let dotProduct = 0;
    let queryMagnitude = 0;
    let candidateMagnitude = 0;

    for (const value of queryVector.values()) {
      queryMagnitude += value * value;
    }

    for (const value of candidateVector.values()) {
      candidateMagnitude += value * value;
    }

    for (const [feature, queryWeight] of queryVector) {
      dotProduct += queryWeight * (candidateVector.get(feature) ?? 0);
    }

    if (queryMagnitude === 0 || candidateMagnitude === 0) {
      return 0;
    }

    return clamp(dotProduct / Math.sqrt(queryMagnitude * candidateMagnitude));
  }

  private buildVector(value: string): Map<string, number> {
    const tokens = normalizeTokens(value);
    const vector = new Map<string, number>();

    for (const token of tokens) {
      addWeight(vector, `term:${token}`, 1);

      for (const equivalent of SEMANTIC_EQUIVALENTS[token] ?? []) {
        addWeight(vector, `term:${normalizeToken(equivalent)}`, 0.68);
      }
    }

    for (let index = 0; index < tokens.length - 1; index += 1) {
      addWeight(vector, `phrase:${tokens[index]} ${tokens[index + 1]}`, 1.15);
    }

    return vector;
  }
}

function normalizeTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 3);
}

function normalizeToken(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.length > 4 && /(ses|xes|zes|ches|shes)$/.test(token)) {
    return token.slice(0, -2);
  }

  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }

  return token;
}

function addWeight(vector: Map<string, number>, feature: string, weight: number): void {
  vector.set(feature, (vector.get(feature) ?? 0) + weight);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
