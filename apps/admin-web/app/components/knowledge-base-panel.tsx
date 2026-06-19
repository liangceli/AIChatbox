"use client";

import type {
  CreateKnowledgeBaseRequest,
  CreateKnowledgeDocumentRequest,
  ImportUrlKnowledgeDocumentRequest,
  KnowledgeBaseRecord,
  KnowledgeDocumentDetail,
  KnowledgeDocumentRecord
} from "@platform/types";
import { FormEvent, useEffect, useState } from "react";
import { AnswerDebugPanel } from "./answer-debug-panel";

type IngestionMethod = "file" | "url";

export function KnowledgeBasePanel({
  apiBaseUrl,
  tenantSlug,
  initialKnowledgeBaseId,
  initialDocumentId
}: {
  apiBaseUrl: string;
  tenantSlug: string;
  initialKnowledgeBaseId?: string;
  initialDocumentId?: string;
}) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRecord[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocumentRecord[]>([]);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const [documentDetail, setDocumentDetail] = useState<KnowledgeDocumentDetail>();
  const [knowledgeBaseName, setKnowledgeBaseName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [ingestionMethod, setIngestionMethod] = useState<IngestionMethod>("file");
  const [error, setError] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeAction, setActiveAction] = useState<string>();

  useEffect(() => {
    setDocuments([]);
    setSelectedDocumentId(undefined);
    setDocumentDetail(undefined);
    void loadKnowledgeBases(initialKnowledgeBaseId);
  }, [initialKnowledgeBaseId, tenantSlug]);

  useEffect(() => {
    if (!selectedKnowledgeBaseId) {
      setDocuments([]);
      setSelectedDocumentId(undefined);
      setDocumentDetail(undefined);
      return;
    }

    void loadDocuments(
      selectedKnowledgeBaseId,
      selectedKnowledgeBaseId === initialKnowledgeBaseId ? initialDocumentId : undefined
    );
  }, [initialDocumentId, initialKnowledgeBaseId, selectedKnowledgeBaseId, tenantSlug]);

  useEffect(() => {
    if (!selectedKnowledgeBaseId || !selectedDocumentId) {
      setDocumentDetail(undefined);
      return;
    }

    void loadDocumentDetail(selectedKnowledgeBaseId, selectedDocumentId);
  }, [selectedKnowledgeBaseId, selectedDocumentId, tenantSlug]);

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        "x-tenant-slug": tenantSlug,
        ...init?.headers
      }
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Knowledge request failed."));
    }

    return response.json() as Promise<T>;
  }

  async function loadKnowledgeBases(nextSelectedId?: string) {
    setError(undefined);

    try {
      const payload = await request<KnowledgeBaseRecord[]>("/knowledge-bases");
      setKnowledgeBases(payload);
      setSelectedKnowledgeBaseId((current) => {
        if (nextSelectedId && payload.some((knowledgeBase) => knowledgeBase.id === nextSelectedId)) {
          return nextSelectedId;
        }

        return current && payload.some((knowledgeBase) => knowledgeBase.id === current)
          ? current
          : payload[0]?.id;
      });
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError, "Unable to load knowledge bases."));
    }
  }

  async function loadDocuments(knowledgeBaseId: string, nextSelectedId?: string) {
    setIsLoadingDocuments(true);
    setError(undefined);

    try {
      const payload = await request<KnowledgeDocumentRecord[]>(
        `/knowledge-bases/${knowledgeBaseId}/documents`
      );
      setDocuments(payload);
      setSelectedDocumentId((current) => {
        if (nextSelectedId && payload.some((document) => document.id === nextSelectedId)) {
          return nextSelectedId;
        }

        return current && payload.some((document) => document.id === current)
          ? current
          : payload[0]?.id;
      });
    } catch (requestError: unknown) {
      setDocuments([]);
      setSelectedDocumentId(undefined);
      setError(toErrorMessage(requestError, "Unable to load knowledge documents."));
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  async function loadDocumentDetail(knowledgeBaseId: string, documentId: string) {
    setIsLoadingDetail(true);
    setError(undefined);

    try {
      setDocumentDetail(
        await request<KnowledgeDocumentDetail>(
          `/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`
        )
      );
    } catch (requestError: unknown) {
      setDocumentDetail(undefined);
      setError(toErrorMessage(requestError, "Unable to load document detail."));
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function createKnowledgeBase(): Promise<KnowledgeBaseRecord | null> {
    const payload: CreateKnowledgeBaseRequest = {
      name: knowledgeBaseName.trim()
    };

    if (!payload.name) {
      return null;
    }

    return request<KnowledgeBaseRecord>("/knowledge-bases", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function uploadKnowledgeFile(knowledgeBaseId: string, file: File) {
    const content = await file.text();
    const payload: CreateKnowledgeDocumentRequest = {
      title: file.name,
      content,
      sourceType: "file",
      sourceUri: file.name,
      metadata: {
        fileName: file.name,
        fileType: file.type || "text/plain",
        fileSize: file.size,
        ingestionMethod: "file"
      }
    };

    return request<KnowledgeDocumentRecord>(`/knowledge-bases/${knowledgeBaseId}/documents`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function importKnowledgeUrl(knowledgeBaseId: string) {
    const payload: ImportUrlKnowledgeDocumentRequest = {
      url: sourceUrl.trim()
    };

    return request<KnowledgeDocumentRecord>(
      `/knowledge-bases/${knowledgeBaseId}/documents/import-url`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
  }

  async function handleIngestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const rawFileInput = form.elements.namedItem("knowledgeFile");
    const fileInput = rawFileInput instanceof HTMLInputElement ? rawFileInput : null;
    const file = fileInput?.files?.[0];

    if (!knowledgeBaseName.trim() && !selectedKnowledgeBaseId) {
      setError("Create or select a knowledge base before adding a document.");
      return;
    }

    if (ingestionMethod === "file" && !file && !knowledgeBaseName.trim()) {
      setError("Choose a text-based file to upload.");
      return;
    }

    if (ingestionMethod === "url" && !sourceUrl.trim()) {
      setError("Enter an http or https source URL.");
      return;
    }

    setIsSubmitting(true);
    setError(undefined);
    setStatusMessage(undefined);

    try {
      const createdKnowledgeBase = await createKnowledgeBase();
      const targetKnowledgeBaseId = createdKnowledgeBase?.id ?? selectedKnowledgeBaseId;

      if (!targetKnowledgeBaseId) {
        throw new Error("Create or select a knowledge base before adding a document.");
      }

      let createdDocument: KnowledgeDocumentRecord | undefined;

      if (ingestionMethod === "file" && file) {
        createdDocument = await uploadKnowledgeFile(targetKnowledgeBaseId, file);
        fileInput.value = "";
      } else if (ingestionMethod === "url") {
        createdDocument = await importKnowledgeUrl(targetKnowledgeBaseId);
        setSourceUrl("");
      }

      setKnowledgeBaseName("");
      await loadKnowledgeBases(targetKnowledgeBaseId);
      await loadDocuments(targetKnowledgeBaseId, createdDocument?.id);
      setStatusMessage(
        createdDocument
          ? `${createdDocument.title} is ready for knowledge QA.`
          : "Knowledge base created."
      );
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError, "Unable to complete ingestion."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function runDocumentAction(action: "reprocess" | "archive" | "delete") {
    if (!selectedKnowledgeBaseId || !documentDetail) {
      return;
    }

    if (
      action === "delete" &&
      !window.confirm(`Delete "${documentDetail.title}" and all of its chunks?`)
    ) {
      return;
    }

    setActiveAction(action);
    setError(undefined);
    setStatusMessage(undefined);

    try {
      const path = `/knowledge-bases/${selectedKnowledgeBaseId}/documents/${documentDetail.id}`;

      if (action === "delete") {
        await request<{ deleted: true }>(path, { method: "DELETE" });
        setSelectedDocumentId(undefined);
        setDocumentDetail(undefined);
        await loadDocuments(selectedKnowledgeBaseId);
        await loadKnowledgeBases(selectedKnowledgeBaseId);
        setStatusMessage(`${documentDetail.title} was deleted.`);
      } else if (action === "archive") {
        const updatedDocument = await request<KnowledgeDocumentRecord>(`${path}/archive`, {
          method: "POST",
          body: JSON.stringify({})
        });
        await loadDocuments(selectedKnowledgeBaseId, updatedDocument.id);
        await loadDocumentDetail(selectedKnowledgeBaseId, updatedDocument.id);
        setStatusMessage(`${updatedDocument.title} was archived.`);
      } else {
        const updatedDocument = await request<KnowledgeDocumentDetail>(`${path}/reprocess`, {
          method: "POST",
          body: JSON.stringify({})
        });
        await loadDocuments(selectedKnowledgeBaseId, updatedDocument.id);
        setDocumentDetail(updatedDocument);
        setStatusMessage(`${updatedDocument.title} was reprocessed.`);
      }
    } catch (requestError: unknown) {
      setError(toErrorMessage(requestError, `Unable to ${action} document.`));
    } finally {
      setActiveAction(undefined);
    }
  }

  const selectedKnowledgeBase = knowledgeBases.find(
    (knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId
  );

  return (
    <>
      <section className="knowledge-grid">
        <div className="knowledge-main">
          <div className="section-heading-row">
            <div>
              <h3>Knowledge Bases</h3>
              <p>Manage tenant-scoped source documents and inspect chunk readiness.</p>
            </div>
            <button
              type="button"
              className="initialize-button primary-btn"
              onClick={() => setKnowledgeBaseName((current) => current || "Core Knowledge")}
            >
              <Icon name="rocket_launch" />
              <span>Initialize Core</span>
            </button>
          </div>

          <KnowledgeBaseTable
            knowledgeBases={knowledgeBases}
            selectedKnowledgeBaseId={selectedKnowledgeBaseId}
            onSelect={setSelectedKnowledgeBaseId}
          />

          <section className="knowledge-documents-panel glass-card">
            <div className="knowledge-panel-heading">
              <div>
                <h4>Documents</h4>
                <p>{selectedKnowledgeBase?.name ?? "Select a knowledge base"}</p>
              </div>
              <span>{documents.length} total</span>
            </div>

            {isLoadingDocuments ? (
              <div className="knowledge-empty-state">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="knowledge-empty-state">
                No documents yet. Upload a file or import a URL to start retrieval QA.
              </div>
            ) : (
              <div className="knowledge-document-list">
                {documents.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    className={selectedDocumentId === document.id ? "selected" : undefined}
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    <div>
                      <strong>{document.title}</strong>
                      <span>{formatSource(document)}</span>
                    </div>
                    <div className="knowledge-document-facts">
                      <span className={`status-pill ${document.status}`}>{document.status}</span>
                      <span>{document.chunkCount} chunks</span>
                      <span>{formatDate(document.ingestedAt ?? document.updatedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {isLoadingDetail ? (
              <div className="knowledge-empty-state">Loading selected document...</div>
            ) : documentDetail ? (
              <KnowledgeDocumentInspector
                document={documentDetail}
                activeAction={activeAction}
                onAction={runDocumentAction}
              />
            ) : null}
          </section>
        </div>

        <aside className="ingest-card glass-card">
          <h4>Ingest Data</h4>
          <form className="ingest-form" onSubmit={handleIngestSubmit}>
            <label>
              <span>New Base Name (optional)</span>
              <input
                value={knowledgeBaseName}
                onChange={(event) => setKnowledgeBaseName(event.target.value)}
                placeholder={selectedKnowledgeBase ? `Using ${selectedKnowledgeBase.name}` : "e.g. Support Wiki"}
              />
            </label>

            <label>
              <span>Ingestion Method</span>
              <select
                value={ingestionMethod}
                onChange={(event) => setIngestionMethod(event.target.value as IngestionMethod)}
              >
                <option value="file">Text File Upload</option>
                <option value="url">URL Import</option>
              </select>
            </label>

            {ingestionMethod === "file" ? (
              <label className="upload-dropzone">
                <input
                  name="knowledgeFile"
                  type="file"
                  accept=".txt,.md,.csv,.json,text/plain,text/markdown,application/json"
                />
                <Icon name="cloud_upload" />
                <span>Tap to upload <strong>browse</strong></span>
              </label>
            ) : (
              <label>
                <span>Source URL</span>
                <input
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://example.com/support/article"
                  type="url"
                />
              </label>
            )}

            <button className="ingest-submit primary-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Start Ingestion"}
            </button>
          </form>
          {statusMessage ? <div className="panel-success" role="status">{statusMessage}</div> : null}
          {error ? <div className="panel-error">{error}</div> : null}
        </aside>
      </section>

      <AnswerDebugPanel apiBaseUrl={apiBaseUrl} tenantSlug={tenantSlug} />
    </>
  );
}

function KnowledgeBaseTable({
  knowledgeBases,
  selectedKnowledgeBaseId,
  onSelect
}: {
  knowledgeBases: KnowledgeBaseRecord[];
  selectedKnowledgeBaseId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="knowledge-table-shell">
      <table className="knowledge-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Documents</th>
            <th>Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {knowledgeBases.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <div className="empty-table-state">No knowledge bases yet.</div>
              </td>
            </tr>
          ) : (
            knowledgeBases.map((knowledgeBase) => {
              const isSelected = selectedKnowledgeBaseId === knowledgeBase.id;

              return (
                <tr key={knowledgeBase.id} className={isSelected ? "selected" : undefined}>
                  <td>
                    <button
                      type="button"
                      className="knowledge-name-button"
                      onClick={() => onSelect(knowledgeBase.id)}
                    >
                      <Icon name="menu_book" />
                      <span>{knowledgeBase.name}</span>
                    </button>
                  </td>
                  <td>{knowledgeBase.documentCount.toLocaleString()} docs</td>
                  <td>{formatDate(knowledgeBase.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="knowledge-open-button"
                      onClick={() => onSelect(knowledgeBase.id)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function KnowledgeDocumentInspector({
  document,
  activeAction,
  onAction
}: {
  document: KnowledgeDocumentDetail;
  activeAction?: string;
  onAction: (action: "reprocess" | "archive" | "delete") => void;
}) {
  const isArchived = document.status === "archived";

  return (
    <div className="knowledge-document-inspector">
      <div className="knowledge-inspector-heading">
        <div>
          <span className={`status-pill ${document.status}`}>{document.status}</span>
          <h4>{document.title}</h4>
          <p>{formatSource(document)}</p>
        </div>
        <div className="knowledge-inspector-actions">
          <button
            type="button"
            onClick={() => onAction("reprocess")}
            disabled={Boolean(activeAction) || isArchived}
          >
            <Icon name="sync" />
            <span>{activeAction === "reprocess" ? "Reprocessing..." : "Reprocess"}</span>
          </button>
          <button
            type="button"
            onClick={() => onAction("archive")}
            disabled={Boolean(activeAction) || isArchived}
          >
            <Icon name="archive" />
            <span>{activeAction === "archive" ? "Archiving..." : "Archive"}</span>
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => onAction("delete")}
            disabled={Boolean(activeAction)}
          >
            <Icon name="delete" />
            <span>{activeAction === "delete" ? "Deleting..." : "Delete"}</span>
          </button>
        </div>
      </div>

      <dl className="knowledge-document-metadata">
        <Metadata label="Source type" value={document.sourceType} />
        <Metadata label="Chunk count" value={String(document.chunkCount)} />
        <Metadata label="Last ingested" value={formatDate(document.ingestedAt ?? document.updatedAt)} />
        <Metadata label="Checksum" value={document.checksum ?? "Not available"} mono />
      </dl>

      <div className="knowledge-chunk-preview">
        <div className="knowledge-panel-heading">
          <div>
            <h4>Chunk Preview</h4>
            <p>Admin-only retrieval source content.</p>
          </div>
          <span>{document.chunks.length} chunks</span>
        </div>
        {document.chunks.length === 0 ? (
          <div className="knowledge-empty-state">No chunks are stored for this document.</div>
        ) : (
          <div className="knowledge-chunk-list">
            {document.chunks.map((chunk) => (
              <article key={chunk.id}>
                <header>
                  <strong>Chunk {chunk.chunkIndex + 1}</strong>
                  <span>{chunk.tokenCount ? `${chunk.tokenCount} tokens` : "Token count unavailable"}</span>
                </header>
                <p>{chunk.content}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metadata({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined}>{value}</dd>
    </div>
  );
}

function formatSource(document: Pick<KnowledgeDocumentRecord, "sourceType" | "sourceUri">): string {
  return document.sourceUri ? `${document.sourceType} · ${document.sourceUri}` : document.sourceType;
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
