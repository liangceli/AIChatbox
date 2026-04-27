"use client";

import { ConversationOpsPanel } from "./conversation-ops-panel";

export function AgentConsole({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  return (
    <main className="agent-shell">
      <header className="agent-header">
        <div>
          <p className="eyebrow">Support console</p>
          <h1>Human handoff inbox</h1>
          <p>Live tenant-scoped conversations that need or recently received human support.</p>
        </div>
        <nav className="surface-links horizontal">
          <a href="/admin">Admin</a>
          <a href="/chat">Customer chat</a>
        </nav>
      </header>

      <section className="agent-workspace">
        <ConversationOpsPanel
          apiBaseUrl={apiBaseUrl}
          tenantSlug={tenantSlug}
          allowAssignment={false}
          allowAdminDeletes={false}
          messagesNewestFirst
        />
      </section>
    </main>
  );
}
