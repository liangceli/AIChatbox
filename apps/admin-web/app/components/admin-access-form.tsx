"use client";

import { FormEvent, useState } from "react";

export function AdminAccessForm({ nextPath }: { nextPath: string }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token
        })
      });

      if (!response.ok) {
        throw new Error(`Access request failed with status ${response.status}`);
      }

      window.location.assign(nextPath);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to unlock admin access.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace" style={{ maxWidth: 520, margin: "0 auto" }}>
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Alpha access</p>
            <h1>Admin access</h1>
          </div>
        </header>

        <form className="tenant-create-form" onSubmit={handleSubmit}>
          <strong>Enter admin-web access token</strong>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Access token"
            type="password"
            autoComplete="current-password"
          />
          <button type="submit" disabled={isSubmitting || !token.trim()}>
            {isSubmitting ? "Checking..." : "Continue"}
          </button>
        </form>

        {error ? <div className="toast-error">{error}</div> : null}
      </section>
    </main>
  );
}
