"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  CreateKnowledgeBaseRequest,
  CreateKnowledgeDocumentRequest,
  KnowledgeBaseRecord,
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
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>();
  const [knowledgeBaseName, setKnowledgeBaseName] = useState("");
  const [knowledgeBaseSlug, setKnowledgeBaseSlug] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentSourceUri, setDocumentSourceUri] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadKnowledgeBases();
  }, [tenantSlug]);

  useEffect(() => {
    if (!selectedKnowledgeBaseId) {
      setDocuments([]);
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
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to load knowledge documents."
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

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Documents</strong>
        {documents.length === 0 ? (
          <div style={{ color: "#6e5f53" }}>No documents yet for the selected knowledge base.</div>
        ) : (
          documents.map((document) => (
            <div
              key={document.id}
              style={{
                borderRadius: "14px",
                border: "1px solid rgba(62, 44, 31, 0.12)",
                background: "#fffaf6",
                padding: "10px 12px"
              }}
            >
              <strong>{document.title}</strong>
              <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>
                status: {document.status} | source: {document.sourceType} | chunks: {document.chunkCount}
              </div>
              {document.sourceUri ? (
                <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>sourceUri: {document.sourceUri}</div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {error ? <div style={{ color: "#b42318" }}>{error}</div> : null}
    </section>
  );
}
