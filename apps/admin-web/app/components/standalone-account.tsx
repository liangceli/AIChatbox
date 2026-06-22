"use client";

import { useEffect, useState } from "react";
import type { AccountRecord } from "@platform/types";
import { AccountPanel } from "./account-panel";

export function StandaloneAccount({ clerkPublishableKey }: { clerkPublishableKey?: string }) {
  const [account, setAccount] = useState<AccountRecord>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void fetch("/api/admin/account/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Account request failed with status ${response.status}`);
        return response.json() as Promise<AccountRecord>;
      })
      .then(setAccount)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : "Unable to load account."));
  }, []);

  return (
    <main className="standalone-account-shell">
      {account ? (
        <AccountPanel
          apiBaseUrl="/api/admin"
          account={account}
          tenantSlug={account.memberships.find((membership) => membership.status === "active")?.tenantSlug ?? ""}
          clerkPublishableKey={clerkPublishableKey}
          onAccountChanged={setAccount}
        />
      ) : error ? <div className="inline-error">{error}</div> : <p>Loading account...</p>}
    </main>
  );
}
