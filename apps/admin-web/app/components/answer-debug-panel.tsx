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
            {result.knowledge.outcome === "hit" ? "Knowledge hit" : "Knowledge miss"}
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
