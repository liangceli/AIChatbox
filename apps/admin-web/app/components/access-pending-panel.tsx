"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { AccountRecord } from "@platform/types";
import { signOutToHome } from "../lib/client-clerk-session";

export function AccessPendingPanel({ clerkPublishableKey }: { clerkPublishableKey?: string }) {
  const [account, setAccount] = useState<AccountRecord>();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    void fetch("/api/admin/account/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Account request failed with status ${response.status}`);
        return response.json() as Promise<AccountRecord>;
      })
      .then((payload) => {
        setAccount(payload);
        if (payload.defaultRoute !== "/access-pending") window.location.assign(payload.defaultRoute);
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Unable to load account."));
  }, []);

  async function acceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const response = await fetch("/api/admin/account/accept-invitation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      setError(`Invitation could not be accepted (${response.status}).`);
      return;
    }

    const payload = (await response.json()) as AccountRecord;
    window.location.assign(payload.defaultRoute);
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel access-pending-panel">
        <p className="auth-kicker">Access pending</p>
        <h1>Your identity is verified</h1>
        <p className="auth-copy">{account?.email || "This Clerk account"} has no active tenant access.</p>
        <p className="pending-access-note">Enter the one-time invitation code issued for your email address. Your tenant and role are assigned by the invitation.</p>
        <form onSubmit={acceptInvitation} className="pending-invitation-form">
          <input required minLength={32} value={token} onChange={(event) => setToken(event.target.value)} placeholder="Invitation token" />
          <button type="submit" className="auth-primary-button">Accept invitation</button>
        </form>
        {error ? <div className="inline-error">{error}</div> : null}
        <button type="button" className="auth-text-button" onClick={() => void signOutToHome(clerkPublishableKey)}>Sign out</button>
      </section>
    </main>
  );
}
