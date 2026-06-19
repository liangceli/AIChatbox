"use client";

import { SignIn, SignUp, useAuth, useClerk, useUser } from "@clerk/nextjs";
import type { AccountRecord } from "@platform/types";
import { useMemo, useState } from "react";

type ClerkAuthPanelProps = {
  mode: "sign-in" | "sign-up";
  publishableKey?: string;
  afterAuthUrl: string;
  redirectUrl?: string;
};

export function ClerkAuthPanel(props: ClerkAuthPanelProps) {
  if (!props.publishableKey) {
    return (
      <main className="auth-shell">
        <section className="auth-panel auth-account-panel">
          <a className="auth-home-link" href="/">Solaris AI</a>
          <div className="inline-error" role="alert">Account authentication is not configured for this environment.</div>
        </section>
      </main>
    );
  }

  return <ClerkAccountFlow {...props} />;
}

function ClerkAccountFlow({ mode, afterAuthUrl, redirectUrl }: ClerkAuthPanelProps) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const safeRedirectUrl = useMemo(() => sanitizeRedirectUrl(redirectUrl) ?? afterAuthUrl, [
    afterAuthUrl,
    redirectUrl
  ]);
  const currentEmail = user?.primaryEmailAddress?.emailAddress
    ?? user?.emailAddresses?.[0]?.emailAddress
    ?? "Clerk account";

  async function continueToWorkspace() {
    setIsSubmitting(true);
    setError(undefined);

    try {
      const token = await getToken();

      if (!token) throw new Error("No active Clerk session is available.");

      const sessionResponse = await fetch("/api/auth/clerk/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store"
      });

      if (!sessionResponse.ok) {
        throw new Error(`Session verification failed: ${await readFailureReason(sessionResponse)}`);
      }

      const accountResponse = await fetch("/api/admin/account/me", { cache: "no-store" });

      if (!accountResponse.ok) throw new Error(`Account lookup failed (${accountResponse.status}).`);

      const account = (await accountResponse.json()) as AccountRecord;
      window.location.assign(resolvePostAuthRoute(account, safeRedirectUrl));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to open the assigned workspace.");
      setIsSubmitting(false);
    }
  }

  async function useAnotherAccount() {
    setIsSubmitting(true);
    setError(undefined);

    try {
      await signOut();
    } finally {
      await fetch("/api/auth/sign-out", { method: "POST" });
      window.location.reload();
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-account-panel">
        <a className="auth-home-link" href="/" aria-label="Back to Solaris AI home">Solaris AI</a>
        <div className="auth-mode-tabs" aria-label="Account access">
          <a className={mode === "sign-in" ? "active" : ""} href="/sign-in">Sign in</a>
          <a className={mode === "sign-up" ? "active" : ""} href="/sign-up">Sign up</a>
        </div>

        <header className="auth-heading">
          <p className="auth-kicker">Secure workspace access</p>
          <h1>{mode === "sign-up" ? "Create your Solaris AI account" : "Welcome back"}</h1>
          <p className="auth-copy">
            {!isLoaded
              ? "Loading account access..."
              : isSignedIn
                ? "Confirm this account before opening its assigned workspace."
                : mode === "sign-up"
                  ? "Create your identity first. Your invitation assigns tenant and role after sign-up."
                  : "Enter your account details to continue to your assigned workspace."}
          </p>
        </header>

        {!isLoaded ? <div className="auth-loading-state">Loading account form...</div> : null}

        {isLoaded && !isSignedIn ? (
          <div className="clerk-form-host">
            {mode === "sign-up" ? (
              <SignUp
                routing="hash"
                signInUrl="/sign-in"
                forceRedirectUrl="/sign-up"
                fallbackRedirectUrl="/sign-up"
                appearance={clerkAppearance}
              />
            ) : (
              <SignIn
                routing="hash"
                signUpUrl="/sign-up"
                forceRedirectUrl="/sign-in"
                fallbackRedirectUrl="/sign-in"
                appearance={clerkAppearance}
              />
            )}
          </div>
        ) : null}

        {isLoaded && isSignedIn ? (
          <div className="auth-session-confirmation">
            <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
            <div>
              <small>Currently signed in</small>
              <strong>{currentEmail}</strong>
              <p>Tenant and role are verified by the server after you continue.</p>
            </div>
            <button className="auth-primary-button" type="button" disabled={isSubmitting} onClick={() => void continueToWorkspace()}>
              {isSubmitting ? "Verifying access..." : "Continue to workspace"}
            </button>
            <button className="auth-secondary-button" type="button" disabled={isSubmitting} onClick={() => void useAnotherAccount()}>
              Use another account
            </button>
          </div>
        ) : null}

        {error ? <div className="inline-error" role="alert">{error}</div> : null}

        <p className="auth-role-note">
          Platform Admin access is pre-authorized. Tenant Owners and Agents activate access with an email-bound invitation code.
        </p>
        <a className="auth-legacy-link" href="/admin/access">Local legacy access</a>
      </section>
    </main>
  );
}

const clerkAppearance = {
  variables: {
    colorPrimary: "#2563eb",
    borderRadius: "6px"
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none" },
    card: { width: "100%", border: "1px solid rgba(0, 0, 0, 0.08)", boxShadow: "none" }
  }
};

function resolvePostAuthRoute(account: AccountRecord, requestedRoute: string): string {
  if (!account.mapped || account.defaultRoute === "/access-pending") return "/access-pending";
  if (account.defaultRoute === "/admin" && requestedRoute.startsWith("/admin")) return requestedRoute;
  if (account.defaultRoute === "/agent" && requestedRoute.startsWith("/agent")) return requestedRoute;
  return account.defaultRoute;
}

async function readFailureReason(response: Response): Promise<string> {
  try {
    const body = JSON.parse(await response.text()) as { error?: unknown; reason?: unknown };

    if (typeof body.reason === "string" && body.reason) return body.reason;
    return typeof body.error === "string" && body.error ? body.error : "unknown";
  } catch {
    return `http-${response.status}`;
  }
}

function sanitizeRedirectUrl(value?: string): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  return value;
}
