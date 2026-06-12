"use client";

import { useEffect, useRef, useState } from "react";
import type { TenantOverviewRecord } from "@platform/types";
import { ConversationOpsPanel } from "./conversation-ops-panel";
import { KnowledgeBasePanel } from "./knowledge-base-panel";
import { TenantAiProfilePanel } from "./tenant-ai-profile-panel";

const drawerNavigationItems = [
  { label: "Dashboard", icon: "dashboard", target: "dashboard" },
  { label: "Knowledge Base", icon: "database", target: "knowledge" },
  { label: "Conversations", icon: "chat", target: "conversations" },
  { label: "Analytics", icon: "bar_chart", comingSoon: true },
  { label: "Settings", icon: "settings", target: "settings" },
  { label: "Support", icon: "help", separated: true, comingSoon: true },
  { label: "Account", icon: "account_circle", comingSoon: true }
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
  const [activeNavigationItem, setActiveNavigationItem] = useState("Dashboard");
  const [navigationNotice, setNavigationNotice] = useState<string>();
  const dashboardRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const knowledgeRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!navigationNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setNavigationNotice(undefined), 2600);

    return () => window.clearTimeout(timeoutId);
  }, [navigationNotice]);

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

  function handleNavigationItemClick(item: (typeof drawerNavigationItems)[number]) {
    if (item.comingSoon || !item.target) {
      showNavigationNotice(`${item.label} is coming soon.`);
      return;
    }

    const section = getNavigationSection(item.target);

    if (!section) {
      showNavigationNotice(`${item.label} is not available yet.`);
      return;
    }

    setActiveNavigationItem(item.label);
    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    section.focus({
      preventScroll: true
    });
    showNavigationNotice(`Focused ${item.label}.`);
    setIsMobileMenuOpen(false);
  }

  function getNavigationSection(target: string): HTMLElement | null {
    switch (target) {
      case "dashboard":
        return dashboardRef.current;
      case "settings":
        return settingsRef.current;
      case "knowledge":
        return knowledgeRef.current;
      case "conversations":
        return conversationsRef.current;
      default:
        return null;
    }
  }

  function showNavigationNotice(message: string) {
    setNavigationNotice(message);
  }

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
            <button
              key={item.label}
              type="button"
              className={`${activeNavigationItem === item.label ? "active" : ""} ${item.separated ? "separated" : ""} ${item.comingSoon ? "disabled" : ""}`}
              aria-disabled={item.comingSoon ? "true" : undefined}
              onClick={() => handleNavigationItemClick(item)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.comingSoon ? <small>Soon</small> : null}
            </button>
          ))}
        </nav>

        {navigationNotice ? (
          <div className="drawer-feedback" role="status">
            {navigationNotice}
          </div>
        ) : null}

        <div className="drawer-footer">
          <button
            type="button"
            className="drawer-primary-button primary-btn"
            onClick={() => showNavigationNotice("New Chatbot is coming soon.")}
          >
            <Icon name="add" />
            <span>New Chatbot</span>
          </button>
        </div>
      </aside>

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

      <div className="admin-screen">
        <main className="admin-page-content" id="workspace">
          <section
            ref={dashboardRef}
            className="stats-grid nav-section"
            aria-label="Tenant statistics"
            tabIndex={-1}
          >
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

          <div ref={settingsRef} className="nav-section" tabIndex={-1}>
            <TenantAiProfilePanel apiBaseUrl={apiBaseUrl} tenantSlug={selectedTenantSlug} />
          </div>

          <div ref={knowledgeRef} className="nav-section" tabIndex={-1}>
            <KnowledgeBasePanel apiBaseUrl={apiBaseUrl} tenantSlug={selectedTenantSlug} />
          </div>

          <div ref={conversationsRef} className="nav-section" tabIndex={-1}>
            <ConversationOpsPanel
              apiBaseUrl={apiBaseUrl}
              tenantSlug={selectedTenantSlug}
              allowAssignment
              allowAdminDeletes
            />
          </div>
        </main>
      </div>

      {error ? <div className="toast-error">{error}</div> : null}
      {navigationNotice ? <div className="toast-info">{navigationNotice}</div> : null}
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
