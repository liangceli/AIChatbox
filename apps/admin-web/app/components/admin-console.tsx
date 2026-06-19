"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { AccountRecord, TenantAiProfile, TenantOverviewRecord } from "@platform/types";
import { AdminGlobalSearch } from "./admin-global-search";
import { ConversationOpsPanel } from "./conversation-ops-panel";
import { KnowledgeBasePanel } from "./knowledge-base-panel";
import { TenantAiProfilePanel } from "./tenant-ai-profile-panel";
import { AccountPanel } from "./account-panel";

const defaultAdminPrimaryColor = "#fec931";
const adminColorSchemeStorageKey = "admin-color-scheme";
type AdminColorScheme = "light" | "dark";

const drawerNavigationItems = [
  { label: "Dashboard", icon: "dashboard", target: "dashboard", href: "/admin" },
  { label: "Knowledge Base", icon: "database", href: "/admin/knowledge-base" },
  { label: "Conversations", icon: "chat", href: "/admin/conversations" },
  { label: "Analytics", icon: "bar_chart", comingSoon: true },
  { label: "Settings", icon: "settings", target: "settings", href: "/admin" },
  { label: "Support", icon: "help", separated: true, comingSoon: true },
  { label: "Account", icon: "account_circle", href: "/admin/account" }
];

const profileImageUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCn5u1vN6rNspRKGCTnzyMfAhnhm2Lk2G_BH5F-X0q9lOdEyB4sxfXsM8KwfBQfr-QSf-Ao7FU0K3zw0juKN7bHDVIuD9GnWPAwuGIvhUf-ZbyRzdEx2cl4N3h6l6Xfs4tu8fATVqHqYgxpHIdO-CNsZC3sBRXShn0jdjtp2ZvfOOTMDoFVbdjxmGWoFisXO_fLKtrMlJk279dVYaAk920zoRPdRWJAlTsNPPd9aRdE2HRnBaYAbEIeMnEBMm1TfFhYxSRmnFQME5Z1";

export function AdminConsole({
  apiBaseUrl,
  defaultTenantSlug,
  view = "dashboard",
  conversationFilter = "pending_human",
  initialConversationId,
  initialKnowledgeBaseId,
  initialKnowledgeDocumentId,
  clerkPublishableKey
}: {
  apiBaseUrl: string;
  defaultTenantSlug: string;
  view?: "dashboard" | "knowledge" | "conversations" | "account";
  conversationFilter?: "all" | "pending_human";
  initialConversationId?: string;
  initialKnowledgeBaseId?: string;
  initialKnowledgeDocumentId?: string;
  clerkPublishableKey?: string;
}) {
  const [tenants, setTenants] = useState<TenantOverviewRecord[]>([]);
  const [account, setAccount] = useState<AccountRecord>();
  const [selectedTenantSlug, setSelectedTenantSlug] = useState(defaultTenantSlug);
  const [error, setError] = useState<string>();
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [themePrimaryColor, setThemePrimaryColor] = useState(defaultAdminPrimaryColor);
  const [colorScheme, setColorScheme] = useState<AdminColorScheme>("light");
  const [activeNavigationItem, setActiveNavigationItem] = useState(
    view === "conversations" ? "Conversations" : view === "knowledge" ? "Knowledge Base" : view === "account" ? "Account" : "Dashboard"
  );
  const [navigationNotice, setNavigationNotice] = useState<string>();
  const dashboardRef = useRef<HTMLElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

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
    let isCurrent = true;

    async function loadAccountAndTenants() {
      setIsLoadingTenants(true);
      setError(undefined);

      try {
        const accountResponse = await fetch(`${apiBaseUrl}/account/me`, { cache: "no-store" });

        if (!accountResponse.ok) {
          throw new Error(`Account request failed with status ${accountResponse.status}`);
        }

        const accountPayload = (await accountResponse.json()) as AccountRecord;

        if (!accountPayload.mapped || accountPayload.defaultRoute === "/access-pending") {
          window.location.assign("/access-pending");
          return;
        }

        if (accountPayload.defaultRoute === "/agent") {
          window.location.assign("/agent");
          return;
        }

        if (!isCurrent) return;
        setAccount(accountPayload);

        if (accountPayload.isPlatformAdmin) {
          await loadTenants();
          return;
        }

        const ownerTenants = accountPayload.memberships
          .filter((membership) => membership.role === "owner" && membership.status === "active")
          .map((membership): TenantOverviewRecord => ({
            id: membership.tenantId,
            slug: membership.tenantSlug,
            name: membership.tenantName,
            status: membership.status,
            conversationCount: membership.conversationCount,
            pendingHumanCount: membership.pendingHumanCount,
            knowledgeBaseCount: membership.knowledgeBaseCount,
            createdAt: "",
            updatedAt: ""
          }));
        setTenants(ownerTenants);
        setSelectedTenantSlug(ownerTenants[0]?.slug ?? defaultTenantSlug);
        setIsLoadingTenants(false);
      } catch (requestError: unknown) {
        if (isCurrent) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load account.");
          setIsLoadingTenants(false);
        }
      }
    }

    void loadAccountAndTenants();
    return () => { isCurrent = false; };
  }, [apiBaseUrl, defaultTenantSlug]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(adminColorSchemeStorageKey);
    const nextTheme =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : document.documentElement.dataset.theme === "dark"
          ? "dark"
          : "light";

    applyAdminColorScheme(nextTheme);
    setColorScheme(nextTheme);
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadTenantTheme() {
      try {
        const response = await fetch(`${apiBaseUrl}/tenants/${encodeURIComponent(selectedTenantSlug)}/ai-profile`);

        if (!response.ok) {
          return;
        }

        const profile = (await response.json()) as TenantAiProfile;

        if (isCurrent) {
          setThemePrimaryColor(normalizeAdminPrimaryColor(profile.primaryColor));
        }
      } catch {
        // Theme loading must not block the admin workspace; protected data panels surface real request errors.
      }
    }

    void loadTenantTheme();

    return () => {
      isCurrent = false;
    };
  }, [apiBaseUrl, selectedTenantSlug]);

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
      tone: "standard",
      href: "/admin/conversations?status=all"
    },
    {
      label: "Pending Human",
      value: activeTenant.pendingHumanCount,
      helper: "Needs attention",
      icon: "person_alert",
      tone: "urgent",
      href: "/admin/conversations?status=pending_human"
    },
    {
      label: "Knowledge Bases",
      value: activeTenant.knowledgeBaseCount,
      helper: "Active",
      icon: "terminal",
      tone: "muted",
      href: "/admin/knowledge-base"
    }
  ];

  function handleNavigationItemClick(item: (typeof drawerNavigationItems)[number]) {
    if (item.comingSoon || !item.target) {
      if (item.href) {
        window.location.assign(item.href);
        return;
      }

      showNavigationNotice(`${item.label} is coming soon.`);
      return;
    }

    if (item.href && item.label === "Dashboard" && view !== "dashboard") {
      window.location.assign(item.href);
      return;
    }

    const section = getNavigationSection(item.target);

    if (!section) {
      if (item.href) {
        window.location.assign(item.href);
        return;
      }

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
      default:
        return null;
    }
  }

  function showNavigationNotice(message: string) {
    setNavigationNotice(message);
  }

  function handlePrimaryColorChange(value: string | null | undefined) {
    setThemePrimaryColor(normalizeAdminPrimaryColor(value));
  }

  function toggleColorScheme() {
    const nextScheme = colorScheme === "dark" ? "light" : "dark";

    applyAdminColorScheme(nextScheme);
    setColorScheme(nextScheme);
  }

  const adminThemeStyle = buildAdminThemeStyle(themePrimaryColor);

  return (
    <main className="admin-dashboard" style={adminThemeStyle}>
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
            disabled={!account?.isPlatformAdmin}
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
          {account?.isPlatformAdmin ? <Icon name="unfold_more" className="tenant-unfold" /> : null}
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

          <AdminGlobalSearch apiBaseUrl={apiBaseUrl} tenantSlug={selectedTenantSlug} />

          <div className="topbar-actions">
            <button type="button" className="topbar-notification" aria-label="Notifications">
              <Icon name="notifications" />
              <span />
            </button>
            <button
              type="button"
              className="theme-toggle-button"
              aria-label={colorScheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={colorScheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleColorScheme}
            >
              <Icon name={colorScheme === "dark" ? "light_mode" : "dark_mode"} />
            </button>
            <div className="topbar-divider" />
            <button type="button" className="deploy-button primary-btn">Deploy</button>
            <Link href="/admin/account" aria-label="Open account"><img alt="User Profile" className="profile-avatar" src={profileImageUrl} /></Link>
          </div>
      </header>

      <div className="admin-screen">
        <main className="admin-page-content" id="workspace">
          {!account ? (
            <p className="admin-loading-state">Loading authorized workspace...</p>
          ) : view === "dashboard" ? (
            <>
              <section
                ref={dashboardRef}
                className="stats-grid nav-section"
                aria-label="Tenant statistics"
                tabIndex={-1}
              >
                {metricCards.map((metric) => (
                  <Link
                    key={metric.label}
                    href={metric.href}
                    className={`stat-card stat-card-link glass-card ${metric.tone}`}
                    aria-label={`Open ${metric.label}`}
                  >
                    <span className="stat-icon">
                      <Icon name={metric.icon} />
                    </span>
                    <div>
                      <p>{metric.label}</p>
                      <h2>{metric.value.toLocaleString()}</h2>
                      <small>{metric.helper}</small>
                    </div>
                  </Link>
                ))}
              </section>

              <div ref={settingsRef} className="nav-section" id="ai-profile" tabIndex={-1}>
                <TenantAiProfilePanel
                  apiBaseUrl={apiBaseUrl}
                  tenantSlug={selectedTenantSlug}
                  onPrimaryColorChange={handlePrimaryColorChange}
                />
              </div>
            </>
          ) : view === "knowledge" ? (
            <section className="nav-section admin-knowledge-page" aria-label="Knowledge Base" tabIndex={-1}>
              <KnowledgeBasePanel
                apiBaseUrl={apiBaseUrl}
                tenantSlug={selectedTenantSlug}
                initialKnowledgeBaseId={initialKnowledgeBaseId}
                initialDocumentId={initialKnowledgeDocumentId}
              />
            </section>
          ) : view === "conversations" ? (
            <section className="nav-section admin-conversations-page" aria-label="Conversations" tabIndex={-1}>
              <ConversationOpsPanel
                apiBaseUrl={apiBaseUrl}
                tenantSlug={selectedTenantSlug}
                initialFilter={conversationFilter}
                initialConversationId={initialConversationId}
                allowAssignment
                allowAdminDeletes
              />
            </section>
          ) : (
            <AccountPanel apiBaseUrl={apiBaseUrl} account={account} tenantSlug={selectedTenantSlug} clerkPublishableKey={clerkPublishableKey} />
          )}
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

function normalizeAdminPrimaryColor(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";

  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : defaultAdminPrimaryColor;
}

function applyAdminColorScheme(colorScheme: AdminColorScheme) {
  document.documentElement.dataset.theme = colorScheme;
  document.documentElement.style.colorScheme = colorScheme;
  window.localStorage.setItem(adminColorSchemeStorageKey, colorScheme);
}

function buildAdminThemeStyle(value: string): CSSProperties {
  const primaryContainer = normalizeAdminPrimaryColor(value);
  const primary = getReadableAccentColor(primaryContainer);
  const primaryStrong = mixHexColor(primaryContainer, "#000000", getRelativeLuminance(primaryContainer) > 0.55 ? 0.5 : 0.18);

  return {
    "--primary": primary,
    "--primary-container": primaryContainer,
    "--on-primary-container": getReadableTextColor(primaryContainer),
    "--primary-strong": primaryStrong,
    "--on-primary-strong": getReadableTextColor(primaryStrong),
    "--primary-soft": hexToRgba(primaryContainer, 0.08),
    "--primary-soft-hover": hexToRgba(primaryContainer, 0.16),
    "--primary-focus": hexToRgba(primaryContainer, 0.24),
    "--primary-border": hexToRgba(primaryContainer, 0.32),
    "--primary-shadow": hexToRgba(primaryContainer, 0.3)
  } as CSSProperties;
}

function getReadableAccentColor(hexColor: string): string {
  return getRelativeLuminance(hexColor) > 0.64 ? mixHexColor(hexColor, "#000000", 0.58) : hexColor;
}

function getReadableTextColor(hexColor: string): string {
  return getRelativeLuminance(hexColor) > 0.56 ? "#171821" : "#ffffff";
}

function getRelativeLuminance(hexColor: string): number {
  const [red, green, blue] = parseHexColor(hexColor);
  const toLinearChannel = (channel: number) => {
    const scaled = channel / 255;

    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const linearRed = toLinearChannel(red);
  const linearGreen = toLinearChannel(green);
  const linearBlue = toLinearChannel(blue);

  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}

function hexToRgba(hexColor: string, alpha: number): string {
  const [red, green, blue] = parseHexColor(hexColor);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function mixHexColor(sourceHex: string, targetHex: string, targetWeight: number): string {
  const source = parseHexColor(sourceHex);
  const target = parseHexColor(targetHex);
  const boundedWeight = Math.min(Math.max(targetWeight, 0), 1);
  const mixed: [number, number, number] = [
    Math.round(source[0] * (1 - boundedWeight) + target[0] * boundedWeight),
    Math.round(source[1] * (1 - boundedWeight) + target[1] * boundedWeight),
    Math.round(source[2] * (1 - boundedWeight) + target[2] * boundedWeight)
  ];

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function parseHexColor(hexColor: string): [number, number, number] {
  const normalized = normalizeAdminPrimaryColor(hexColor).slice(1);

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}
