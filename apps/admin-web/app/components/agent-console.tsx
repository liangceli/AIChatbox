"use client";

import { useEffect, useState } from "react";
import type { AccountRecord } from "@platform/types";
import { ConversationOpsPanel } from "./conversation-ops-panel";

export function AgentConsole({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  const [resolvedTenantSlug, setResolvedTenantSlug] = useState(tenantSlug);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void fetch(`${apiBaseUrl}/account/me`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Account request failed with status ${response.status}`);
        return response.json() as Promise<AccountRecord>;
      })
      .then((account) => {
        if (!account.mapped || account.defaultRoute === "/access-pending") {
          window.location.assign("/access-pending");
          return;
        }

        if (account.defaultRoute !== "/agent") {
          window.location.assign(account.defaultRoute);
          return;
        }

        const membership = account.memberships.find(
          (candidate) => candidate.role === "agent" && candidate.status === "active"
        );

        if (!membership) {
          window.location.assign("/access-pending");
          return;
        }

        setResolvedTenantSlug(membership.tenantSlug);
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Unable to load account."));
  }, [apiBaseUrl]);

  return (
    <main className="agent-shell">
      <header className="agent-header">
        <div>
          <p className="eyebrow">Support console</p>
          <h1>Human handoff inbox</h1>
          <p>Live tenant-scoped conversations that need or recently received human support.</p>
        </div>
        <nav className="surface-links horizontal">
          <a href="/chat">Customer chat</a>
          <a href="/account">Account</a>
        </nav>
      </header>

      <section className="agent-workspace">
        <ConversationOpsPanel
          apiBaseUrl={apiBaseUrl}
          tenantSlug={resolvedTenantSlug}
          allowAssignment={false}
          allowAdminDeletes={false}
        />
      </section>
      {error ? <div className="toast-error">{error}</div> : null}
    </main>
  );
}
