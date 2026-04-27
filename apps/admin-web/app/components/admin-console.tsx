"use client";

import { FormEvent, useEffect, useState } from "react";
import type { CreateTenantRequest, TenantOverviewRecord } from "@platform/types";
import { ConversationOpsPanel } from "./conversation-ops-panel";
import { KnowledgeBasePanel } from "./knowledge-base-panel";

export function AdminConsole({
  apiBaseUrl,
  defaultTenantSlug
}: {
  apiBaseUrl: string;
  defaultTenantSlug: string;
}) {
  const [tenants, setTenants] = useState<TenantOverviewRecord[]>([]);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState(defaultTenantSlug);
  const [error, setError] = useState<string>();
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantSupportEmail, setTenantSupportEmail] = useState("");
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);

  async function loadTenants(nextSelectedSlug?: string) {
    setIsLoadingTenants(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/tenants`);

      if (!response.ok) {
        throw new Error(`Tenant request failed with status ${response.status}`);
      }

      const rawPayload = (await response.json()) as TenantOverviewRecord[] | { value?: TenantOverviewRecord[] };
      const payload = Array.isArray(rawPayload)
        ? rawPayload
        : Array.isArray(rawPayload.value)
          ? rawPayload.value
          : [];

      setTenants(payload);
      setSelectedTenantSlug((current) => {
        if (nextSelectedSlug && payload.some((tenant) => tenant.slug === nextSelectedSlug)) {
          return nextSelectedSlug;
        }

        return payload.some((tenant) => tenant.slug === current) ? current : payload[0]?.slug ?? current;
      });
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load tenants.");
    } finally {
      setIsLoadingTenants(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, [apiBaseUrl]);

  async function handleTenantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreateTenantRequest = {
      name: tenantName.trim(),
      slug: tenantSlug.trim().toLowerCase(),
      supportEmail: tenantSupportEmail.trim() || undefined
    };

    if (!payload.name || !payload.slug) {
      return;
    }

    setIsCreatingTenant(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Tenant create failed with status ${response.status}`);
      }

      const createdTenant = (await response.json()) as TenantOverviewRecord;
      setTenantName("");
      setTenantSlug("");
      setTenantSupportEmail("");
      await loadTenants(createdTenant.slug);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create tenant.");
    } finally {
      setIsCreatingTenant(false);
    }
  }

  const selectedTenant = tenants.find((tenant) => tenant.slug === selectedTenantSlug);
  const tenantOptions =
    tenants.length > 0
      ? tenants
      : [
          {
            id: defaultTenantSlug,
            slug: defaultTenantSlug,
            name: defaultTenantSlug,
            status: "active",
            conversationCount: 0,
            pendingHumanCount: 0,
            knowledgeBaseCount: 0,
            createdAt: "",
            updatedAt: ""
          }
        ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <img className="brand-mark" src="/images/logo.png" alt="Platform logo" />
          <h1>Platform Admin</h1>
          <p>Tenants, knowledge, conversations, and human handoff operations.</p>
        </div>

        <label className="field">
          <span>Tenant</span>
          <select
            value={selectedTenantSlug}
            onChange={(event) => setSelectedTenantSlug(event.target.value)}
          >
            {isLoadingTenants ? <option value={selectedTenantSlug}>Loading tenants...</option> : null}
            {!isLoadingTenants && tenantOptions.map((tenant) => (
              <option key={tenant.id} value={tenant.slug}>
                {tenant.name} ({tenant.slug})
              </option>
            ))}
          </select>
          {!isLoadingTenants && tenants.length === 0 ? (
            <small>Using default tenant because the tenant list did not load.</small>
          ) : null}
        </label>

        {selectedTenant ? (
          <div className="metric-list">
            <div>
              <strong>{selectedTenant.conversationCount}</strong>
              <span>Conversations</span>
            </div>
            <div>
              <strong>{selectedTenant.pendingHumanCount}</strong>
              <span>Pending human</span>
            </div>
            <div>
              <strong>{selectedTenant.knowledgeBaseCount}</strong>
              <span>Knowledge bases</span>
            </div>
          </div>
        ) : null}

        <form className="tenant-create-form" onSubmit={handleTenantSubmit}>
          <strong>Register tenant</strong>
          <input
            value={tenantName}
            onChange={(event) => setTenantName(event.target.value)}
            placeholder="Tenant name"
          />
          <input
            value={tenantSlug}
            onChange={(event) => setTenantSlug(event.target.value.toLowerCase())}
            placeholder="tenant-slug"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
          <input
            value={tenantSupportEmail}
            onChange={(event) => setTenantSupportEmail(event.target.value)}
            placeholder="Optional support admin email"
            type="email"
          />
          <button type="submit" disabled={isCreatingTenant || !tenantName.trim() || !tenantSlug.trim()}>
            {isCreatingTenant ? "Creating..." : "Create tenant"}
          </button>
        </form>

        <nav className="surface-links">
          <a href="/agent">Agent console</a>
          <a href="/chat">Customer chat</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Admin workspace</p>
            <h2>{selectedTenant?.name ?? selectedTenantSlug}</h2>
          </div>
          <span className="status-chip">Live</span>
        </header>

        <div className="split-grid">
          <article className="work-panel">
            <KnowledgeBasePanel apiBaseUrl={apiBaseUrl} tenantSlug={selectedTenantSlug} />
          </article>
          <article className="work-panel">
            <ConversationOpsPanel
              apiBaseUrl={apiBaseUrl}
              tenantSlug={selectedTenantSlug}
              allowAssignment
              allowAdminDeletes
            />
          </article>
        </div>
      </section>

      {error ? <div className="toast-error">{error}</div> : null}
    </main>
  );
}
