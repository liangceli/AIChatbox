"use client";

import { useEffect, useState } from "react";
import type { TenantOverviewRecord } from "@platform/types";
import { ConversationOpsPanel } from "./conversation-ops-panel";
import { KnowledgeBasePanel } from "./knowledge-base-panel";

const drawerNavigationItems = [
  { label: "Dashboard", icon: "dashboard", active: true },
  { label: "Knowledge Base", icon: "database" },
  { label: "Conversations", icon: "chat" },
  { label: "Analytics", icon: "bar_chart" },
  { label: "Settings", icon: "settings" },
  { label: "Support", icon: "help", separated: true },
  { label: "Account", icon: "account_circle" }
];

const profileImageUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCn5u1vN6rNspRKGCTnzyMfAhnhm2Lk2G_BH5F-X0q9lOdEyB4sxfXsM8KwfBQfr-QSf-Ao7FU0K3zw0juKN7bHDVIuD9GnWPAwuGIvhUf-ZbyRzdEx2cl4N3h6l6Xfs4tu8fATVqHqYgxpHIdO-CNsZC3sBRXShn0jdjtp2ZvfOOTMDoFVbdjxmGWoFisXO_fLKtrMlJk279dVYaAk920zoRPdRWJAlTsNPPd9aRdE2HRnBaYAbEIeMnEBMm1TfFhYxSRmnFQME5Z1";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const selectedTenant = tenants.find((tenant) => tenant.slug === selectedTenantSlug);
  const fallbackTenant: TenantOverviewRecord = {
    id: defaultTenantSlug,
    slug: defaultTenantSlug,
    name: defaultTenantSlug,
    status: "active",
    conversationCount: 0,
    pendingHumanCount: 0,
    knowledgeBaseCount: 0,
    createdAt: "",
    updatedAt: ""
  };
  const tenantOptions = tenants.length > 0 ? tenants : [fallbackTenant];
  const activeTenant = selectedTenant ?? fallbackTenant;
  const tenantName = activeTenant.name || activeTenant.slug;
  const tenantInitial = getInitials(tenantName);
  const metricCards = [
    {
      label: "Conversations",
      value: activeTenant.conversationCount,
      helper: "+12% vs LW",
      icon: "chat_bubble",
      tone: "standard"
    },
    {
      label: "Pending Human",
      value: activeTenant.pendingHumanCount,
      helper: "Needs attention",
      icon: "person_alert",
      tone: "urgent"
    },
    {
      label: "Knowledge Bases",
      value: activeTenant.knowledgeBaseCount,
      helper: "Active",
      icon: "terminal",
      tone: "muted"
    }
  ];

  return (
    <main className="admin-dashboard">
      <button
        type="button"
        className={`drawer-overlay ${isMobileMenuOpen ? "open" : ""}`}
        aria-label="Close navigation drawer"
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside className={`mobile-drawer ${isMobileMenuOpen ? "open" : ""}`} aria-label="Admin navigation">
        <div className="drawer-header">
          <h1>Solaris AI</h1>
          <button
            type="button"
            className="nav-icon-button"
            aria-label="Close navigation drawer"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <label className="tenant-switcher">
          <select
            aria-label="Tenant"
            value={selectedTenantSlug}
            onChange={(event) => {
              setSelectedTenantSlug(event.target.value);
              setIsMobileMenuOpen(false);
            }}
          >
            {isLoadingTenants ? <option value={selectedTenantSlug}>Loading tenants...</option> : null}
            {!isLoadingTenants && tenantOptions.map((tenant) => (
              <option key={tenant.id} value={tenant.slug}>
                {tenant.name} ({tenant.slug})
              </option>
            ))}
          </select>
          <span className="tenant-avatar">{tenantInitial}</span>
          <span className="tenant-copy">
            <strong>{tenantName}</strong>
            <small>Tenant</small>
          </span>
          <Icon name="unfold_more" className="tenant-unfold" />
        </label>

        <nav className="drawer-nav">
          {drawerNavigationItems.map((item) => (
            <a
              key={item.label}
              className={`${item.active ? "active" : ""} ${item.separated ? "separated" : ""}`}
              href="#workspace"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="drawer-footer">
          <button type="button" className="drawer-primary-button primary-btn">
            <Icon name="add" />
            <span>New Chatbot</span>
          </button>
        </div>
      </aside>

      <div className="admin-screen">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="nav-icon-button"
              aria-label="Open navigation drawer"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <h1>Solaris AI</h1>
          </div>

          <label className="topbar-search">
            <Icon name="search" />
            <input type="search" placeholder="Search resources..." />
          </label>

          <div className="topbar-actions">
            <button type="button" className="topbar-notification" aria-label="Notifications">
              <Icon name="notifications" />
              <span />
            </button>
            <div className="topbar-divider" />
            <button type="button" className="deploy-button primary-btn">Deploy</button>
            <img alt="User Profile" className="profile-avatar" src={profileImageUrl} />
          </div>
        </header>

        <main className="admin-page-content" id="workspace">
          <section className="stats-grid" aria-label="Tenant statistics">
            {metricCards.map((metric) => (
              <article key={metric.label} className={`stat-card glass-card ${metric.tone}`}>
                <span className="stat-icon">
                  <Icon name={metric.icon} />
                </span>
                <div>
                  <p>{metric.label}</p>
                  <h2>{metric.value.toLocaleString()}</h2>
                  <small>{metric.helper}</small>
                </div>
              </article>
            ))}
          </section>

          <KnowledgeBasePanel apiBaseUrl={apiBaseUrl} tenantSlug={selectedTenantSlug} />

          <ConversationOpsPanel
            apiBaseUrl={apiBaseUrl}
            tenantSlug={selectedTenantSlug}
            allowAssignment
            allowAdminDeletes
          />
        </main>
      </div>

      {error ? <div className="toast-error">{error}</div> : null}
    </main>
  );
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function getInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "S";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
