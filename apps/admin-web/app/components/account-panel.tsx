"use client";

import { useEffect, useState, type FormEvent } from "react";
import type {
  AccountRecord,
  CreatedTenantInvitation,
  TenantInvitationRecord,
  TenantMemberRecord
} from "@platform/types";

export function AccountPanel({
  apiBaseUrl,
  account,
  tenantSlug,
  clerkPublishableKey
}: {
  apiBaseUrl: string;
  account: AccountRecord;
  tenantSlug: string;
  clerkPublishableKey?: string;
}) {
  const [members, setMembers] = useState<TenantMemberRecord[]>([]);
  const [invitations, setInvitations] = useState<TenantInvitationRecord[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "AGENT">("AGENT");
  const [createdToken, setCreatedToken] = useState<string>();
  const [error, setError] = useState<string>();
  const canManageMembers = account.isPlatformAdmin || account.memberships.some(
    (membership) => membership.tenantSlug === tenantSlug && membership.role === "owner" && membership.status === "active"
  );

  useEffect(() => {
    if (!canManageMembers || !tenantSlug) {
      return;
    }

    void loadMemberData();
  }, [apiBaseUrl, canManageMembers, tenantSlug]);

  async function loadMemberData() {
    setError(undefined);
    const headers = { "x-tenant-slug": tenantSlug };
    const [membersResponse, invitationsResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/members`, { headers, cache: "no-store" }),
      fetch(`${apiBaseUrl}/members/invitations`, { headers, cache: "no-store" })
    ]);

    if (!membersResponse.ok || !invitationsResponse.ok) {
      setError("Unable to load tenant access records.");
      return;
    }

    setMembers((await membersResponse.json()) as TenantMemberRecord[]);
    setInvitations((await invitationsResponse.json()) as TenantInvitationRecord[]);
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setCreatedToken(undefined);
    const response = await fetch(`${apiBaseUrl}/members/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-slug": tenantSlug
      },
      body: JSON.stringify({ email, role })
    });

    if (!response.ok) {
      setError(`Invitation failed with status ${response.status}.`);
      return;
    }

    const invitation = (await response.json()) as CreatedTenantInvitation;
    setCreatedToken(invitation.token);
    setEmail("");
    await loadMemberData();
  }

  async function updateStatus(member: TenantMemberRecord) {
    const nextStatus = member.status === "active" ? "SUSPENDED" : "ACTIVE";
    const response = await fetch(`${apiBaseUrl}/members/${encodeURIComponent(member.userId)}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-tenant-slug": tenantSlug
      },
      body: JSON.stringify({ status: nextStatus })
    });

    if (!response.ok) {
      setError(`Membership update failed with status ${response.status}.`);
      return;
    }

    await loadMemberData();
  }

  async function signOut() {
    try {
      if (clerkPublishableKey) {
        await loadClerkClient(clerkPublishableKey);
        await window.Clerk?.signOut?.();
      }
    } finally {
      await fetch("/api/auth/sign-out", { method: "POST" });
      window.location.assign("/sign-in");
    }
  }

  return (
    <section className="account-panel glass-card">
      <header className="section-heading-row">
        <div>
          <p className="eyebrow">Account</p>
          <h2>{account.name || account.email || "Signed-in user"}</h2>
          <p>{account.isPlatformAdmin ? "Platform administrator" : "Tenant account"}</p>
        </div>
        <button type="button" className="secondary-btn" onClick={signOut}>Sign out</button>
      </header>

      <div className="account-memberships">
        {account.memberships.map((membership) => (
          <div key={membership.tenantId} className="account-row">
            <strong>{membership.tenantName}</strong>
            <span>{membership.role} · {membership.status}</span>
          </div>
        ))}
      </div>

      {canManageMembers ? (
        <>
          <div className="section-heading-row compact">
            <div>
              <h3>Tenant access</h3>
              <p>Invite and suspend users without exposing another tenant.</p>
            </div>
          </div>
          <form className="invitation-form" onSubmit={createInvitation}>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@company.com" />
            {account.isPlatformAdmin ? (
              <select value={role} onChange={(event) => setRole(event.target.value as "OWNER" | "AGENT")}>
                <option value="AGENT">Agent</option>
                <option value="OWNER">Tenant owner</option>
              </select>
            ) : null}
            <button type="submit" className="primary-btn">Create invitation</button>
          </form>
          {createdToken ? (
            <div className="invitation-token" role="status">
              <strong>One-time invitation token</strong>
              <code>{createdToken}</code>
            </div>
          ) : null}
          <div className="account-table">
            {members.map((member) => (
              <div key={member.userId} className="account-row">
                <span><strong>{member.name || member.email}</strong><small>{member.role} · {member.status}</small></span>
                {(account.isPlatformAdmin || member.role === "agent") && member.userId !== account.userId ? (
                  <button type="button" className="secondary-btn" onClick={() => void updateStatus(member)}>
                    {member.status === "active" ? "Suspend" : "Activate"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {invitations.length ? <p className="account-note">{invitations.length} invitation record(s) retained for audit.</p> : null}
        </>
      ) : null}

      {error ? <div className="inline-error">{error}</div> : null}
    </section>
  );
}

async function loadClerkClient(publishableKey: string): Promise<void> {
  if (!window.Clerk) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.dataset.clerkJs = "true";
      script.dataset.clerkPublishableKey = publishableKey;
      script.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5.111.0/dist/clerk.browser.js";
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load Clerk sign-out."));
      document.head.appendChild(script);
    });
  }

  await window.Clerk?.load();
}
