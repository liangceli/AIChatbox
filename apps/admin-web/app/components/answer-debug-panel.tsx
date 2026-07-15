"use client";

import type { AnswerDebugRequest, AnswerDebugResult } from "@platform/types";
import { FormEvent, useState } from "react";

export function AnswerDebugPanel({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AnswerDebugResult>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  async function runDebug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: AnswerDebugRequest = {
      question: question.trim()
    };

    if (!payload.question) {
      setError("Enter a question to inspect the answer path.");
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/chat/answer-debug`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Answer debug request failed."));
      }

      setResult((await response.json()) as AnswerDebugResult);
    } catch (requestError: unknown) {
      setResult(undefined);
      setError(requestError instanceof Error ? requestError.message : "Unable to run answer debug.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="answer-debug-panel glass-card" aria-labelledby="answer-debug-title">
      <div className="section-heading-row">
        <div>
          <h3 id="answer-debug-title">Answer Debug</h3>
          <p>Inspect tenant-scoped retrieval, citations, and the active provider without creating a conversation.</p>
        </div>
        {result ? (
          <span className={`debug-outcome ${result.knowledge.outcome}`}>
            {formatKnowledgeOutcome(result.knowledge.outcome)}
          </span>
        ) : null}
      </div>

      <form className="answer-debug-form" onSubmit={runDebug}>
        <label>
          <span>Test question</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question that should be answered from this tenant's knowledge."
            maxLength={4000}
          />
        </label>
        <button className="primary-btn debug-run-button" type="submit" disabled={isLoading}>
          <Icon name={isLoading ? "progress_activity" : "troubleshoot"} />
          <span>{isLoading ? "Running..." : "Run Answer Debug"}</span>
        </button>
      </form>

      {error ? <div className="panel-error">{error}</div> : null}

      {!result && !error && !isLoading ? (
        <div className="debug-empty-state">
          Run a question to see the answer, retrieval evidence, citations, and safe provider metadata.
        </div>
      ) : null}

      {result ? (
        <div className="answer-debug-results">
          <div className="debug-summary-grid">
            <DebugFact label="Tenant" value={`${result.tenant.displayName} (${result.tenant.slug})`} />
            <DebugFact label="Requested provider" value={result.provider.requestedMode} />
            <DebugFact label="Used provider" value={result.provider.usedMode} />
            <DebugFact label="Fallback" value={result.provider.usedFallback ? "Yes" : "No"} />
            <DebugFact label="Turn type" value={result.knowledge.detection?.turnType ?? "new_question"} />
            <DebugFact label="Confidence" value={result.knowledge.retrievalConfidence} />
            <DebugFact label="Retrieved chunks" value={String(result.knowledge.retrievedChunkCount)} />
            <DebugFact label="Citations" value={String(result.knowledge.citationCount)} />
            <DebugFact label="Source diversity" value={String(result.knowledge.sourceDiversity)} />
          </div>

          <article className="debug-answer-card">
            <div>
              <span>Generated answer</span>
              <small>{formatAnswerSource(result.answerSource)}</small>
            </div>
            <p>{result.answer}</p>
            <small>{result.knowledge.reason}</small>
            {result.knowledge.warnings.length > 0 ? (
              <ul className="debug-warning-list">
                {result.knowledge.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </article>

          {result.knowledge.detection ? (
            <article className="debug-answer-card">
              <div>
                <span>Retrieval detection</span>
                <small>{result.knowledge.detection.intent ?? "no intent"}</small>
              </div>
              <p>{result.knowledge.detection.confidenceReason ?? "No confidence reason returned."}</p>
              <small>
                Product scope: {result.knowledge.detection.productContext
                  ? formatKnowledgeMetadata(result.knowledge.detection.productContext)
                  : "none"}
              </small>
              {result.knowledge.detection.retrievalSkipped ? (
                <small>Retrieval: skipped ({result.knowledge.detection.skipReason ?? "conversational_turn"})</small>
              ) : null}
              {result.knowledge.detection.confidenceBestScore !== undefined ? (
                <small>
                  Best score: {result.knowledge.detection.confidenceBestScore}
                  {result.knowledge.detection.confidenceBestCoverage !== undefined
                    ? ` / coverage ${Math.round(result.knowledge.detection.confidenceBestCoverage * 100)}%`
                    : ""}
                </small>
              ) : null}
              {result.knowledge.detection.clarificationOptions?.length ? (
                <small>Candidate options: {result.knowledge.detection.clarificationOptions.join(", ")}</small>
              ) : null}
            </article>
          ) : null}

          {result.knowledge.retrieval ? (
            <article className="debug-answer-card hybrid-retrieval-debug">
              <div>
                <span>Hybrid retrieval</span>
                <small>{result.knowledge.retrieval.retrievalMode}</small>
              </div>
              <div className="debug-summary-grid">
                <DebugFact
                  label="Keyword candidates"
                  value={String(result.knowledge.retrieval.keywordCandidateChunkIds.length)}
                />
                <DebugFact
                  label="Vector candidates"
                  value={String(result.knowledge.retrieval.vectorCandidateChunkIds.length)}
                />
                <DebugFact
                  label="Merged candidates"
                  value={String(result.knowledge.retrieval.mergedCandidateChunkIds.length)}
                />
                <DebugFact
                  label="Selected chunks"
                  value={String(result.knowledge.retrieval.selectedChunkIds.length)}
                />
                <DebugFact
                  label="Top-K"
                  value={`${result.knowledge.retrieval.keywordTopK} / ${result.knowledge.retrieval.vectorTopK} / ${result.knowledge.retrieval.finalTopK}`}
                />
                <DebugFact
                  label="Hybrid confidence"
                  value={result.knowledge.retrieval.confidence.toFixed(4)}
                />
                <DebugFact
                  label="Retrieval"
                  value={result.knowledge.retrieval.retrievalSkipped ? "skipped" : "executed"}
                />
              </div>
              <small>Effective question: {result.knowledge.retrieval.effectiveQuestion}</small>
              <div className="hybrid-score-list">
                {result.knowledge.retrieval.scores.slice(0, 8).map((score) => (
                  <div key={score.chunkId}>
                    <strong>{score.chunkId}</strong>
                    <span>Final {score.finalScore.toFixed(4)}</span>
                    <span>Keyword {score.keywordScore.toFixed(4)}</span>
                    <span>Vector {score.vectorScore.toFixed(4)}</span>
                    <span>Metadata {score.metadataScore.toFixed(4)}</span>
                    <span>Exact {score.exactMatchBoost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {result.knowledge.ambiguity?.isAmbiguous ? (
            <article className="debug-answer-card">
              <div>
                <span>Ambiguity check</span>
                <small>{result.knowledge.ambiguity.intent ?? "unknown intent"}</small>
              </div>
              <p>{result.knowledge.ambiguity.clarificationQuestion}</p>
              {result.knowledge.ambiguity.options?.length ? (
                <small>Options: {result.knowledge.ambiguity.options.join(", ")}</small>
              ) : null}
            </article>
          ) : null}

          <div className="debug-detail-grid">
            <section className="debug-detail-section">
              <div className="debug-detail-heading">
                <h4>Retrieved chunks</h4>
                <span>{result.retrievedChunks.length}</span>
              </div>
              {result.retrievedChunks.length === 0 ? (
                <div className="debug-empty-state">No READY knowledge chunk met the retrieval threshold.</div>
              ) : (
                <div className="debug-card-list">
                  {result.retrievedChunks.map((chunk) => (
                    <article key={chunk.chunkId} className="debug-evidence-card">
                      <div>
                        <strong>{chunk.title}</strong>
                        <span>Chunk {chunk.chunkIndex + 1}</span>
                      </div>
                      <p>{chunk.contentPreview}</p>
                      <footer>
                        <span>Score: {chunk.relevanceScore ?? "n/a"}</span>
                        {chunk.knowledgeMetadata ? (
                          <span>{formatKnowledgeMetadata(chunk.knowledgeMetadata)}</span>
                        ) : null}
                        {chunk.sourceUri && isHttpUrl(chunk.sourceUri) ? (
                          <a href={chunk.sourceUri} target="_blank" rel="noreferrer">
                            Source
                          </a>
                        ) : chunk.sourceUri ? (
                          <span>{chunk.sourceUri}</span>
                        ) : (
                          <span>No source URL</span>
                        )}
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="debug-detail-section">
              <div className="debug-detail-heading">
                <h4>Citations</h4>
                <span>{result.citations.length}</span>
              </div>
              {result.citations.length === 0 ? (
                <div className="debug-empty-state">No backend citation was attached to this answer.</div>
              ) : (
                <div className="debug-card-list">
                  {result.citations.map((citation) => (
                    <article key={`${citation.chunkId}-${citation.chunkIndex}`} className="debug-evidence-card citation">
                      <div>
                        <strong>{citation.title}</strong>
                        <span>Chunk {citation.chunkIndex + 1}</span>
                      </div>
                      {citation.excerpt ? <p>{citation.excerpt}</p> : null}
                    </article>
                  ))}
                </div>
              )}

              <div className="debug-provider-metadata">
                <h4>Safe provider metadata</h4>
                <dl>
                  <DebugMetadata label="Provider" value={result.provider.metadata.providerName} />
                  <DebugMetadata label="Mode" value={result.provider.metadata.mode} />
                  <DebugMetadata
                    label="Deterministic"
                    value={result.provider.metadata.deterministic ? "Yes" : "No"}
                  />
                  <DebugMetadata label="Model" value={result.provider.metadata.model} />
                  <DebugMetadata
                    label="Fallback reason"
                    value={result.provider.metadata.fallbackReason}
                  />
                  <DebugMetadata
                    label="Latency"
                    value={
                      result.provider.metadata.latencyMs === undefined
                        ? undefined
                        : `${result.provider.metadata.latencyMs} ms`
                    }
                  />
                  <DebugMetadata label="Response ID" value={result.provider.metadata.responseId} />
                </dl>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DebugFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DebugMetadata({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatKnowledgeOutcome(outcome: AnswerDebugResult["knowledge"]["outcome"]): string {
  switch (outcome) {
    case "hit":
      return "Knowledge hit";
    case "clarification":
      return "Clarification";
    case "skipped":
      return "Conversation reply";
    default:
      return "Knowledge miss";
  }
}

function formatKnowledgeMetadata(
  metadata: NonNullable<AnswerDebugResult["retrievedChunks"][number]["knowledgeMetadata"]>
): string {
  return [
    metadata.productSeries,
    metadata.productName,
    metadata.modelNumber,
    metadata.deviceType
  ].filter(Boolean).join(" / ");
}

function formatAnswerSource(value: AnswerDebugResult["answerSource"]): string {
  return value.replaceAll("_", " ");
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    const message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;

    return message?.trim() || `${fallback} Status ${response.status}.`;
  } catch {
    return `${fallback} Status ${response.status}.`;
  }
}

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined">{name}</span>;
}
