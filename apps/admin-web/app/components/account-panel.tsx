"use client";

import { useEffect, useState, type FormEvent } from "react";
import type {
  AccountRecord,
  CreatedTenantInvitation,
  TenantInvitationPolicyRecord,
  TenantInvitationRecord,
  TenantMemberRecord,
  TenantOverviewRecord
} from "@platform/types";
import { signOutToHome } from "../lib/client-clerk-session";
import { UserAvatarEditor } from "./user-avatar-editor";

export function AccountPanel({
  apiBaseUrl,
  account,
  tenantSlug,
  clerkPublishableKey,
  tenantOverviews = [],
  onTenantDataChanged,
  onAccountChanged
}: {
  apiBaseUrl: string;
  account: AccountRecord;
  tenantSlug: string;
  clerkPublishableKey?: string;
  tenantOverviews?: TenantOverviewRecord[];
  onTenantDataChanged?: () => Promise<void>;
  onAccountChanged?: (account: AccountRecord) => void;
}) {
  const [members, setMembers] = useState<TenantMemberRecord[]>([]);
  const [invitations, setInvitations] = useState<TenantInvitationRecord[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "AGENT">("AGENT");
  const [createdToken, setCreatedToken] = useState<string>();
  const [invitationPolicy, setInvitationPolicy] = useState<TenantInvitationPolicyRecord>();
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
    const [membersResponse, invitationsResponse, policyResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/members`, { headers, cache: "no-store" }),
      fetch(`${apiBaseUrl}/members/invitations`, { headers, cache: "no-store" }),
      fetch(`${apiBaseUrl}/members/invitation-policy`, { headers, cache: "no-store" })
    ]);

    if (!membersResponse.ok || !invitationsResponse.ok || !policyResponse.ok) {
      setError("Unable to load tenant access records.");
      return;
    }

    setMembers((await membersResponse.json()) as TenantMemberRecord[]);
    setInvitations((await invitationsResponse.json()) as TenantInvitationRecord[]);
    setInvitationPolicy((await policyResponse.json()) as TenantInvitationPolicyRecord);
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
    await onTenantDataChanged?.();
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
    await onTenantDataChanged?.();
  }

  async function revokeInvitation(invitation: TenantInvitationRecord) {
    setError(undefined);
    const response = await fetch(`${apiBaseUrl}/members/invitations/${encodeURIComponent(invitation.id)}/revoke`, {
      method: "POST",
      headers: { "x-tenant-slug": tenantSlug }
    });

    if (!response.ok) {
      setError(`Invitation revoke failed with status ${response.status}.`);
      return;
    }

    await loadMemberData();
    await onTenantDataChanged?.();
  }

  async function updateInvitationQuota(tenant: TenantOverviewRecord, quota: number) {
    setError(undefined);
    const response = await fetch(
      `${apiBaseUrl}/tenants/${encodeURIComponent(tenant.slug)}/agent-invitation-quota`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quota })
      }
    );

    if (!response.ok) {
      setError(`Invitation quota update failed with status ${response.status}.`);
      return;
    }

    await onTenantDataChanged?.();
  }

  return (
    <section className="account-panel glass-card">
      <header className="section-heading-row">
        <div>
          <p className="eyebrow">Account</p>
          <h2>{account.name || account.email || "Signed-in user"}</h2>
          <p>{account.isPlatformAdmin ? "Platform administrator" : "Tenant account"}</p>
        </div>
        <button type="button" className="secondary-btn" onClick={() => void signOutToHome(clerkPublishableKey)}>Sign out</button>
      </header>

      <UserAvatarEditor apiBaseUrl={apiBaseUrl} account={account} onAccountChanged={onAccountChanged} />

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
          {invitationPolicy ? (
            <div className="invitation-policy" role="status">
              <strong>{invitationPolicy.activeAgentInvitationCount} of {invitationPolicy.agentInvitationQuota}</strong>
              <span>active Agent invitation codes. Each code is single-use and expires after 12 hours.</span>
            </div>
          ) : null}
          <form className="invitation-form" onSubmit={createInvitation}>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@company.com" />
            {account.isPlatformAdmin ? (
              <select value={role} onChange={(event) => setRole(event.target.value as "OWNER" | "AGENT")}>
                <option value="AGENT">Agent</option>
                <option value="OWNER">Tenant owner</option>
              </select>
            ) : null}
            <button
              type="submit"
              className="primary-btn"
              disabled={role === "AGENT" && Boolean(invitationPolicy && invitationPolicy.activeAgentInvitationCount >= invitationPolicy.agentInvitationQuota)}
            >
              Create invitation
            </button>
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
          {invitations.length ? (
            <div className="invitation-records" aria-label="Invitation records">
              <h3>Invitation records</h3>
              {invitations.map((invitation) => {
                const isActive = !invitation.acceptedAt && !invitation.revokedAt && new Date(invitation.expiresAt).getTime() > Date.now();
                const status = invitation.acceptedAt ? "accepted" : invitation.revokedAt ? "revoked" : isActive ? "active" : "expired";

                return (
                  <div className="account-row" key={invitation.id}>
                    <span>
                      <strong>{invitation.email}</strong>
                      <small>{invitation.role} · {status} · expires {new Date(invitation.expiresAt).toLocaleString()}</small>
                    </span>
                    {isActive && (account.isPlatformAdmin || invitation.role === "agent") ? (
                      <button type="button" className="secondary-btn" onClick={() => void revokeInvitation(invitation)}>Revoke</button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}

      {account.isPlatformAdmin && tenantOverviews.length > 0 ? (
        <section className="platform-tenant-access" aria-labelledby="platform-tenant-access-heading">
          <div className="section-heading-row compact">
            <div>
              <h3 id="platform-tenant-access-heading">Tenant access overview</h3>
              <p>Agent invitation limits are enforced independently for every tenant.</p>
            </div>
          </div>
          <div className="tenant-access-table" role="table" aria-label="Tenant access overview">
            <div className="tenant-access-row tenant-access-header" role="row">
              <span>Tenant</span><span>Owners</span><span>Agents</span><span>Suspended</span><span>Active codes</span><span>Code limit</span>
            </div>
            {tenantOverviews.map((tenant) => (
              <div className="tenant-access-row" role="row" key={tenant.id}>
                <span><strong>{tenant.name}</strong><small>{tenant.slug}</small></span>
                <span>{tenant.ownerCount}</span>
                <span>{tenant.agentCount}</span>
                <span>{tenant.suspendedMemberCount}</span>
                <span>{tenant.activeAgentInvitationCount}</span>
                <label>
                  <span className="sr-only">Agent invitation limit for {tenant.name}</span>
                  <select
                    value={tenant.agentInvitationQuota}
                    onChange={(event) => void updateInvitationQuota(tenant, Number(event.target.value))}
                  >
                    {[0, 1, 2, 3, 4, 5].map((quota) => <option key={quota} value={quota}>{quota}</option>)}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? <div className="inline-error">{error}</div> : null}
    </section>
  );
}
