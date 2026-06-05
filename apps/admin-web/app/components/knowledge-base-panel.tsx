"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  CreateKnowledgeBaseRequest,
  CreateKnowledgeDocumentRequest,
  KnowledgeBaseRecord
} from "@platform/types";

export function KnowledgeBasePanel({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseRecord[]>([]);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>();
  const [knowledgeBaseName, setKnowledgeBaseName] = useState("");
  const [ingestionMethod, setIngestionMethod] = useState("document");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadKnowledgeBases();
  }, [tenantSlug]);

  async function loadKnowledgeBases(nextSelectedId?: string) {
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
      setSelectedKnowledgeBaseId((current) => {
        if (nextSelectedId && payload.some((knowledgeBase) => knowledgeBase.id === nextSelectedId)) {
          return nextSelectedId;
        }

        return current && payload.some((knowledgeBase) => knowledgeBase.id === current)
          ? current
          : payload[0]?.id;
      });
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load knowledge bases.");
    }
  }

  async function createKnowledgeBase(): Promise<KnowledgeBaseRecord | null> {
    const payload: CreateKnowledgeBaseRequest = {
      name: knowledgeBaseName.trim()
    };

    if (!payload.name) {
      return null;
    }

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

    return response.json() as Promise<KnowledgeBaseRecord>;
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
        ingestionMethod
      }
    };

    const response = await fetch(`${apiBaseUrl}/knowledge-bases/${knowledgeBaseId}/documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-slug": tenantSlug
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`File document upload failed with status ${response.status}`);
    }
  }

  async function handleIngestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rawFileInput = event.currentTarget.elements.namedItem("knowledgeFile");
    const fileInput = rawFileInput instanceof HTMLInputElement ? rawFileInput : null;
    const file = fileInput?.files?.[0];

    if (!knowledgeBaseName.trim() && !file) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const createdKnowledgeBase = await createKnowledgeBase();
      const targetKnowledgeBaseId = createdKnowledgeBase?.id ?? selectedKnowledgeBaseId;

      if (file) {
        if (!targetKnowledgeBaseId) {
          throw new Error("Create or select a knowledge base before uploading a file.");
        }

        await uploadKnowledgeFile(targetKnowledgeBaseId, file);
        fileInput.value = "";
      }

      setKnowledgeBaseName("");
      await loadKnowledgeBases(targetKnowledgeBaseId);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to start ingestion.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="knowledge-grid">
      <div className="knowledge-main">
        <div className="section-heading-row">
          <div>
            <h3>Knowledge Bases</h3>
            <p>Manage AI source documents.</p>
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

        <div className="knowledge-table-shell">
          <table className="knowledge-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Records</th>
                <th>Actions</th>
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
                knowledgeBases.map((knowledgeBase, index) => {
                  const isSelected = selectedKnowledgeBaseId === knowledgeBase.id;

                  return (
                    <tr key={knowledgeBase.id} className={isSelected ? "selected" : undefined}>
                      <td>
                        <button
                          type="button"
                          className="knowledge-name-button"
                          onClick={() => setSelectedKnowledgeBaseId(knowledgeBase.id)}
                        >
                          <Icon name={index % 2 === 0 ? "description" : "menu_book"} />
                          <span>{knowledgeBase.name}</span>
                        </button>
                      </td>
                      <td>
                        <span className={`status-pill ${isSelected ? "syncing" : "ready"}`}>
                          {isSelected ? "Syncing" : "Ready"}
                        </span>
                      </td>
                      <td>{knowledgeBase.documentCount.toLocaleString()} docs</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            aria-label={`Sync ${knowledgeBase.name}`}
                            onClick={() => setSelectedKnowledgeBaseId(knowledgeBase.id)}
                          >
                            <Icon name="sync" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${knowledgeBase.name}`}
                            onClick={() => setSelectedKnowledgeBaseId(knowledgeBase.id)}
                          >
                            <Icon name="edit" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="ingest-card glass-card">
        <h4>Ingest Data</h4>
        <form className="ingest-form" onSubmit={handleIngestSubmit}>
          <label>
            <span>Base Name</span>
            <input
              value={knowledgeBaseName}
              onChange={(event) => setKnowledgeBaseName(event.target.value)}
              placeholder="e.g. Support Wiki"
            />
          </label>

          <label>
            <span>Ingestion Method</span>
            <select
              value={ingestionMethod}
              onChange={(event) => setIngestionMethod(event.target.value)}
            >
              <option value="document">Document Upload (PDF/DOCX)</option>
              <option value="url">URL Crawler</option>
              <option value="api">API Webhook</option>
            </select>
          </label>

          <label className="upload-dropzone">
            <input
              name="knowledgeFile"
              type="file"
              accept=".txt,.md,.csv,.json,text/plain,text/markdown,application/json"
            />
            <Icon name="cloud_upload" />
            <span>Tap to upload <strong>browse</strong></span>
          </label>

          <button className="ingest-submit primary-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Starting..." : "Start Ingestion"}
          </button>
        </form>
        {error ? <div className="panel-error">{error}</div> : null}
      </aside>
    </section>
  );
}

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined">{name}</span>;
}
