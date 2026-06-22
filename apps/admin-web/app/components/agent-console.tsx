"use client";

import { useEffect, useState } from "react";
import type { AccountRecord, PublicTenantAiProfile } from "@platform/types";
import { ConversationOpsPanel } from "./conversation-ops-panel";
import {
  adminColorSchemeStorageKey,
  applyAdminColorScheme,
  buildAdminThemeStyle,
  defaultAdminPrimaryColor
} from "../lib/tenant-theme";
import { redirectToSignIn, refreshClerkSession, signOutToHome } from "../lib/client-clerk-session";

export function AgentConsole({
  apiBaseUrl,
  clerkPublishableKey
}: {
  apiBaseUrl: string;
  clerkPublishableKey?: string;
}) {
  const [resolvedTenantSlug, setResolvedTenantSlug] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountAvatarUrl, setAccountAvatarUrl] = useState<string>();
  const [themePrimaryColor, setThemePrimaryColor] = useState(defaultAdminPrimaryColor);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(adminColorSchemeStorageKey);
    applyAdminColorScheme(storedTheme === "dark" ? "dark" : "light");
  }, []);

  useEffect(() => {
    void (async () => {
      if (clerkPublishableKey) {
        try {
          await refreshClerkSession(clerkPublishableKey);
        } catch {
          // The account request below remains the authoritative session check.
        }
      }

      return fetch(`${apiBaseUrl}/account/me`, { cache: "no-store" });
    })()
      .then(async (response) => {
        if (response.status === 401) {
          redirectToSignIn();
          throw new Error("Clerk session refresh is required.");
        }

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
        setCurrentUserId(account.userId || "");
        setAccountEmail(account.email || "Agent account");
        setAccountAvatarUrl(account.avatarUrl || undefined);
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Unable to load account."));
  }, [apiBaseUrl, clerkPublishableKey]);

  useEffect(() => {
    if (!clerkPublishableKey) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshClerkSession(clerkPublishableKey).catch(() => undefined);
    }, 45_000);

    return () => window.clearInterval(intervalId);
  }, [clerkPublishableKey]);

  useEffect(() => {
    if (!resolvedTenantSlug) {
      return;
    }

    let isCurrent = true;

    async function loadTenantTheme() {
      try {
        const response = await fetch(`${apiBaseUrl}/tenant-profile`, {
          headers: { "x-tenant-slug": resolvedTenantSlug },
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Tenant theme request failed with status ${response.status}`);
        }

        const profile = (await response.json()) as PublicTenantAiProfile;

        if (isCurrent) {
          setThemePrimaryColor(profile.primaryColor || defaultAdminPrimaryColor);
        }
      } catch (requestError: unknown) {
        if (isCurrent) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load tenant theme.");
        }
      }
    }

    void loadTenantTheme();
    return () => { isCurrent = false; };
  }, [apiBaseUrl, resolvedTenantSlug]);

  return (
    <main className="agent-shell" style={buildAdminThemeStyle(themePrimaryColor)}>
      <header className="agent-header">
        <div>
          <p className="eyebrow">Support console</p>
          <h1>Human handoff inbox</h1>
          <p>Live tenant-scoped conversations that need or recently received human support.</p>
        </div>
        <div className="agent-header-actions">
          <nav className="surface-links horizontal" aria-label="Agent links">
            <a href="/chat">Customer chat</a>
            <a href="/account">Account</a>
          </nav>
          <span className="agent-account-label">{accountEmail || "Signed-in Agent"}</span>
          <a className="agent-account-avatar" href="/account" aria-label="Open account">
            {accountAvatarUrl ? <img src={accountAvatarUrl} alt="User profile" /> : <span aria-hidden="true">{(accountEmail || "A").charAt(0).toUpperCase()}</span>}
          </a>
          <button className="agent-sign-out-button" type="button" onClick={() => void signOutToHome(clerkPublishableKey)}>
            <span className="material-symbols-outlined" aria-hidden="true">logout</span>
            Sign out
          </button>
        </div>
      </header>

      <section className="agent-workspace">
        {resolvedTenantSlug && currentUserId ? (
          <ConversationOpsPanel
            apiBaseUrl={apiBaseUrl}
            tenantSlug={resolvedTenantSlug}
            currentUserId={currentUserId}
            allowAssignment={false}
            allowAdminDeletes={false}
          />
        ) : <p className="admin-loading-state">Loading authorized workspace...</p>}
      </section>
      {error ? <div className="toast-error">{error}</div> : null}
    </main>
  );
}
