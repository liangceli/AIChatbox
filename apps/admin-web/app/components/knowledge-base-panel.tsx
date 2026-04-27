"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  CreateKnowledgeBaseRequest,
  CreateKnowledgeDocumentRequest,
  ImportUrlKnowledgeDocumentRequest,
  ImportUrlKnowledgeDocumentResult,
  KnowledgeBaseRecord,
  KnowledgeDocumentDetail,
  KnowledgeDocumentRecord
} from "@platform/types";

const sectionStyle = {
  display: "grid",
  gap: "14px"
} as const;

export function KnowledgeBasePanel({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRecord[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocumentRecord[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocumentDetail | null>(null);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>();
  const [knowledgeBaseName, setKnowledgeBaseName] = useState("");
  const [knowledgeBaseSlug, setKnowledgeBaseSlug] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentSourceUri, setDocumentSourceUri] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [urlImportTitle, setUrlImportTitle] = useState("");
  const [urlImportValue, setUrlImportValue] = useState("");
  const [urlImportResults, setUrlImportResults] = useState<ImportUrlKnowledgeDocumentResult[]>([]);
  const [isDocumentsExpanded, setIsDocumentsExpanded] = useState(false);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadKnowledgeBases();
  }, [tenantSlug]);

  useEffect(() => {
    if (!selectedKnowledgeBaseId) {
      setDocuments([]);
      setSelectedDocument(null);
      return;
    }

    void loadDocuments(selectedKnowledgeBaseId);
  }, [selectedKnowledgeBaseId, tenantSlug]);

  async function loadKnowledgeBases() {
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/knowledge-bases`, {
        headers: {
          "x-tenant-slug": tenantSlug
        }
      });

      if (!response.ok) {
        throw new Error(`Knowledge base request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as KnowledgeBaseRecord[];
      setKnowledgeBases(payload);
      setSelectedKnowledgeBaseId((current) =>
        current && payload.some((knowledgeBase) => knowledgeBase.id === current)
          ? current
          : payload[0]?.id
      );
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to load knowledge bases."
      );
    }
  }

  async function loadDocuments(knowledgeBaseId: string) {
    try {
      const response = await fetch(`${apiBaseUrl}/knowledge-bases/${knowledgeBaseId}/documents`, {
        headers: {
          "x-tenant-slug": tenantSlug
        }
      });

      if (!response.ok) {
        throw new Error(`Knowledge document request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as KnowledgeDocumentRecord[];
      setDocuments(payload);
      setSelectedDocument((current) =>
        current && payload.some((document) => document.id === current.id) ? current : null
      );
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to load knowledge documents."
      );
    }
  }

  async function loadDocumentDetail(knowledgeBaseId: string, documentId: string) {
    setError(undefined);

    try {
      const response = await fetch(
        `${apiBaseUrl}/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`,
        {
          headers: {
            "x-tenant-slug": tenantSlug
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Knowledge document detail request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as KnowledgeDocumentDetail;
      setSelectedDocument(payload);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to load knowledge document detail."
      );
    }
  }

  async function handleKnowledgeBaseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreateKnowledgeBaseRequest = {
      name: knowledgeBaseName.trim(),
      slug: knowledgeBaseSlug.trim() || undefined
    };

    if (!payload.name) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/knowledge-bases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Knowledge base create failed with status ${response.status}`);
      }

      const knowledgeBase = (await response.json()) as KnowledgeBaseRecord;
      await loadKnowledgeBases();
      setSelectedKnowledgeBaseId(knowledgeBase.id);
      setKnowledgeBaseName("");
      setKnowledgeBaseSlug("");
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to create knowledge base."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDocumentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedKnowledgeBaseId) {
      setError("Select a knowledge base first.");
      return;
    }

    const payload: CreateKnowledgeDocumentRequest = {
      title: documentTitle.trim(),
      content: documentContent.trim(),
      sourceType: "manual",
      sourceUri: documentSourceUri.trim() || undefined
    };

    if (!payload.title || !payload.content) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch(
        `${apiBaseUrl}/knowledge-bases/${selectedKnowledgeBaseId}/documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": tenantSlug
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`Knowledge document create failed with status ${response.status}`);
      }

      await loadDocuments(selectedKnowledgeBaseId);
      await loadKnowledgeBases();
      setIsDocumentsExpanded(true);
      setDocumentTitle("");
      setDocumentSourceUri("");
      setDocumentContent("");
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to create knowledge document."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFileUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedKnowledgeBaseId) {
      setError("Select a knowledge base first.");
      return;
    }

    const fileInput = event.currentTarget.elements.namedItem("knowledgeFile");

    if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
      setError("Choose a text file first.");
      return;
    }

    const file = fileInput.files[0];
    const content = await file.text();
    const payload: CreateKnowledgeDocumentRequest = {
      title: file.name,
      content,
      sourceType: "file",
      sourceUri: file.name,
      metadata: {
        fileName: file.name,
        fileType: file.type || "text/plain",
        fileSize: file.size
      }
    };

    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch(
        `${apiBaseUrl}/knowledge-bases/${selectedKnowledgeBaseId}/documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": tenantSlug
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`File document upload failed with status ${response.status}`);
      }

      fileInput.value = "";
      await loadDocuments(selectedKnowledgeBaseId);
      await loadKnowledgeBases();
      setIsDocumentsExpanded(true);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to upload file.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUrlImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedKnowledgeBaseId) {
      setError("Select a knowledge base first.");
      return;
    }

    const urls = parseUrlList(urlImportValue);

    if (urls.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const singleUrlWithTitle = urls.length === 1 && urlImportTitle.trim();
      const response = await fetch(
        singleUrlWithTitle
          ? `${apiBaseUrl}/knowledge-bases/${selectedKnowledgeBaseId}/documents/import-url`
          : `${apiBaseUrl}/knowledge-bases/${selectedKnowledgeBaseId}/documents/import-urls`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": tenantSlug
          },
          body: JSON.stringify(
            singleUrlWithTitle
              ? ({
                  url: urls[0]!,
                  title: urlImportTitle.trim()
                } satisfies ImportUrlKnowledgeDocumentRequest)
              : {
                  urls
                }
          )
        }
      );

      if (!response.ok) {
        throw new Error(`URL import failed with status ${response.status}`);
      }

      if (singleUrlWithTitle) {
        const document = (await response.json()) as KnowledgeDocumentRecord;
        setUrlImportResults([{ url: urls[0]!, status: "ready", document }]);
      } else {
        const results = (await response.json()) as ImportUrlKnowledgeDocumentResult[];
        setUrlImportResults(results);
      }

      setUrlImportTitle("");
      setUrlImportValue("");
      await loadDocuments(selectedKnowledgeBaseId);
      await loadKnowledgeBases();
      setIsDocumentsExpanded(true);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to import URL.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReprocessDocument(documentId: string) {
    if (!selectedKnowledgeBaseId) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch(
        `${apiBaseUrl}/knowledge-bases/${selectedKnowledgeBaseId}/documents/${documentId}/reprocess`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": tenantSlug
          },
          body: JSON.stringify({})
        }
      );

      if (!response.ok) {
        throw new Error(`Knowledge document reprocess failed with status ${response.status}`);
      }

      const payload = (await response.json()) as KnowledgeDocumentDetail;
      setSelectedDocument(payload);
      await loadDocuments(selectedKnowledgeBaseId);
      await loadKnowledgeBases();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to reprocess knowledge document."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchiveDocument(documentId: string) {
    if (!selectedKnowledgeBaseId) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch(
        `${apiBaseUrl}/knowledge-bases/${selectedKnowledgeBaseId}/documents/${documentId}/archive`,
        {
          method: "POST",
          headers: {
            "x-tenant-slug": tenantSlug
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Knowledge document archive failed with status ${response.status}`);
      }

      setSelectedDocument(null);
      await loadDocuments(selectedKnowledgeBaseId);
      await loadKnowledgeBases();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to archive knowledge document."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!selectedKnowledgeBaseId) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch(
        `${apiBaseUrl}/knowledge-bases/${selectedKnowledgeBaseId}/documents/${documentId}`,
        {
          method: "DELETE",
          headers: {
            "x-tenant-slug": tenantSlug
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Knowledge document delete failed with status ${response.status}`);
      }

      setSelectedDocument(null);
      await loadDocuments(selectedKnowledgeBaseId);
      await loadKnowledgeBases();
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to delete knowledge document."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section style={sectionStyle}>
      <div>
        <strong>Knowledge bases</strong>
        <div style={{ color: "#6e5f53", fontSize: "0.95rem", marginTop: 6 }}>
          Tenant-scoped manual ingestion and chunk inspection.
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {knowledgeBases.map((knowledgeBase) => (
          <button
            key={knowledgeBase.id}
            type="button"
            onClick={() => setSelectedKnowledgeBaseId(knowledgeBase.id)}
            style={{
              textAlign: "left",
              borderRadius: "14px",
              border:
                selectedKnowledgeBaseId === knowledgeBase.id
                  ? "1px solid #231a14"
                  : "1px solid rgba(62, 44, 31, 0.12)",
              background: "#fffaf6",
              padding: "10px 12px",
              cursor: "pointer"
            }}
          >
            <strong>{knowledgeBase.name}</strong>
            <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>
              slug: {knowledgeBase.slug} | docs: {knowledgeBase.documentCount}
            </div>
          </button>
        ))}
      </div>

      <form onSubmit={handleKnowledgeBaseSubmit} style={{ display: "grid", gap: 8 }}>
        <input
          value={knowledgeBaseName}
          onChange={(event) => setKnowledgeBaseName(event.target.value)}
          placeholder="New knowledge base name"
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid rgba(62, 44, 31, 0.12)"
          }}
        />
        <input
          value={knowledgeBaseSlug}
          onChange={(event) => setKnowledgeBaseSlug(event.target.value)}
          placeholder="Optional slug"
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid rgba(62, 44, 31, 0.12)"
          }}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            alignSelf: "start",
            border: 0,
            borderRadius: "999px",
            padding: "10px 14px",
            background: "#231a14",
            color: "#fffaf6",
            cursor: "pointer"
          }}
        >
          Create knowledge base
        </button>
      </form>

      <form onSubmit={handleDocumentSubmit} style={{ display: "grid", gap: 8 }}>
        <strong>Manual document ingestion</strong>
        <input
          value={documentTitle}
          onChange={(event) => setDocumentTitle(event.target.value)}
          placeholder="Document title"
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid rgba(62, 44, 31, 0.12)"
          }}
        />
        <input
          value={documentSourceUri}
          onChange={(event) => setDocumentSourceUri(event.target.value)}
          placeholder="Optional source URI"
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid rgba(62, 44, 31, 0.12)"
          }}
        />
        <textarea
          value={documentContent}
          onChange={(event) => setDocumentContent(event.target.value)}
          placeholder="Paste the knowledge content here"
          style={{
            minHeight: "140px",
            borderRadius: "14px",
            border: "1px solid rgba(62, 44, 31, 0.12)",
            padding: "12px",
            font: "inherit"
          }}
        />
        <button
          type="submit"
          disabled={isSubmitting || !selectedKnowledgeBaseId}
          style={{
            alignSelf: "start",
            border: 0,
            borderRadius: "999px",
            padding: "10px 14px",
            background: "#231a14",
            color: "#fffaf6",
            cursor: "pointer"
          }}
        >
          Create document and chunk
        </button>
      </form>

      <form onSubmit={handleFileUpload} style={{ display: "grid", gap: 8 }}>
        <strong>Upload file</strong>
        <input
          name="knowledgeFile"
          type="file"
          accept=".txt,.md,.csv,.json,text/plain,text/markdown,application/json"
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid rgba(62, 44, 31, 0.12)",
            background: "#fff"
          }}
        />
        <button
          type="submit"
          disabled={isSubmitting || !selectedKnowledgeBaseId}
          style={{
            alignSelf: "start",
            border: 0,
            borderRadius: "999px",
            padding: "10px 14px",
            background: "#231a14",
            color: "#fffaf6",
            cursor: "pointer"
          }}
        >
          Upload and process file
        </button>
      </form>

      <form onSubmit={handleUrlImport} style={{ display: "grid", gap: 8 }}>
        <strong>Import webpages</strong>
        <input
          value={urlImportTitle}
          onChange={(event) => setUrlImportTitle(event.target.value)}
          placeholder="Optional title for single URL import"
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid rgba(62, 44, 31, 0.12)"
          }}
        />
        <textarea
          value={urlImportValue}
          onChange={(event) => setUrlImportValue(event.target.value)}
          placeholder={"Paste URLs here, one per line.\nhttps://example.com/support/article\nhttps://example.com/faq"}
          style={{
            minHeight: "120px",
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid rgba(62, 44, 31, 0.12)",
            font: "inherit"
          }}
        />
        <button
          type="submit"
          disabled={isSubmitting || !selectedKnowledgeBaseId || !urlImportValue.trim()}
          style={{
            alignSelf: "start",
            border: 0,
            borderRadius: "999px",
            padding: "10px 14px",
            background: "#231a14",
            color: "#fffaf6",
            cursor: "pointer"
          }}
        >
          Fetch URLs and process
        </button>
        {urlImportResults.length > 0 ? (
          <div style={{ display: "grid", gap: 6, fontSize: "0.9rem" }}>
            <strong>Import results</strong>
            {urlImportResults.map((result) => (
              <div
                key={result.url}
                style={{
                  color: result.status === "ready" ? "#027a48" : "#b42318",
                  wordBreak: "break-word"
                }}
              >
                {result.status === "ready" ? "Ready" : "Failed"}: {result.url}
                {result.error ? ` - ${result.error}` : ""}
              </div>
            ))}
          </div>
        ) : null}
      </form>

      <div style={{ display: "grid", gap: 8 }}>
        <button
          type="button"
          onClick={() => setIsDocumentsExpanded((current) => !current)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderRadius: "12px",
            border: "1px solid rgba(62, 44, 31, 0.12)",
            background: "#fffaf6",
            padding: "10px 12px",
            cursor: "pointer",
            fontWeight: 800
          }}
        >
          <span>Documents ({documents.length})</span>
          <span>{isDocumentsExpanded ? "Collapse" : "Expand"}</span>
        </button>
        {isDocumentsExpanded && documents.length === 0 ? (
          <div style={{ color: "#6e5f53" }}>No documents yet for the selected knowledge base.</div>
        ) : null}
        {isDocumentsExpanded
          ? documents.map((document) => (
            <div
              key={document.id}
              style={{
                display: "grid",
                gap: 8,
                borderRadius: "14px",
                border:
                  selectedDocument?.id === document.id
                    ? "1px solid #231a14"
                    : "1px solid rgba(62, 44, 31, 0.12)",
                background: "#fffaf6",
                padding: "10px 12px",
                cursor: "default"
              }}
            >
              <button
                type="button"
                onClick={() =>
                  selectedKnowledgeBaseId
                    ? void loadDocumentDetail(selectedKnowledgeBaseId, document.id)
                    : undefined
                }
                style={{
                  textAlign: "left",
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer"
                }}
              >
                <strong>{document.title}</strong>
                <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>
                  status: {document.status} | source: {document.sourceType} | chunks: {document.chunkCount}
                </div>
                {document.sourceUri ? (
                  <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>sourceUri: {document.sourceUri}</div>
                ) : null}
                {document.ingestedAt ? (
                  <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>
                    ingested: {new Date(document.ingestedAt).toLocaleString()}
                  </div>
                ) : null}
              </button>
              {document.status !== "archived" ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleDeleteDocument(document.id)}
                  style={{
                    justifySelf: "start",
                    borderRadius: "999px",
                    padding: "7px 10px",
                    background: "#fff",
                    color: "#b42318",
                    border: "1px solid rgba(180, 35, 24, 0.22)",
                    cursor: "pointer",
                    fontSize: "0.85rem"
                  }}
                >
                  Delete document
                </button>
              ) : null}
            </div>
          ))
          : null}
      </div>

      {isDocumentsExpanded && selectedDocument ? (
        <div style={{ display: "grid", gap: 10 }}>
          <strong>Document detail</strong>
          <div
            style={{
              borderRadius: "14px",
              border: "1px solid rgba(62, 44, 31, 0.12)",
              background: "#fffaf6",
              padding: "10px 12px"
            }}
          >
            <div>Title: {selectedDocument.title}</div>
            <div>Status: {selectedDocument.status}</div>
            <div>Chunks: {selectedDocument.chunkCount}</div>
            <div>Document ID: {selectedDocument.id}</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              disabled={isSubmitting || selectedDocument.status === "archived"}
              onClick={() => void handleReprocessDocument(selectedDocument.id)}
              style={{
                border: 0,
                borderRadius: "999px",
                padding: "10px 14px",
                background: "#231a14",
                color: "#fffaf6",
                cursor: "pointer"
              }}
            >
              Reprocess document
            </button>
            <button
              type="button"
              disabled={isSubmitting || selectedDocument.status === "archived"}
              onClick={() => void handleArchiveDocument(selectedDocument.id)}
              style={{
                borderRadius: "999px",
                padding: "10px 14px",
                background: "#ffffff",
                color: "#231a14",
                border: "1px solid rgba(62, 44, 31, 0.18)",
                cursor: "pointer"
              }}
            >
              Archive document
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <strong>Chunks</strong>
            {selectedDocument.chunks.length === 0 ? (
              <div style={{ color: "#6e5f53" }}>No chunks stored for this document.</div>
            ) : (
              selectedDocument.chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  style={{
                    borderRadius: "14px",
                    border: "1px solid rgba(62, 44, 31, 0.12)",
                    background: "#fffaf6",
                    padding: "10px 12px"
                  }}
                >
                  <strong>Chunk {chunk.chunkIndex}</strong>
                  <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>
                    tokens: {chunk.tokenCount ?? "n/a"} | id: {chunk.id}
                  </div>
                  <div style={{ marginTop: 6 }}>{chunk.content}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {error ? <div style={{ color: "#b42318" }}>{error}</div> : null}
    </section>
  );
}

function parseUrlList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((url) => url.trim())
        .filter(Boolean)
    )
  );
}
