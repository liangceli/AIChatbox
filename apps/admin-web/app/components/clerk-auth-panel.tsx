"use client";

import { useEffect, useMemo, useState } from "react";

type ClerkAuthPanelProps = {
  mode: "sign-in" | "sign-up";
  publishableKey?: string;
  afterAuthUrl: string;
  redirectUrl?: string;
};

declare global {
  interface Window {
    Clerk?: {
      load: () => Promise<void>;
      openSignIn: (options?: { redirectUrl?: string; afterSignInUrl?: string }) => void;
      openSignUp: (options?: { redirectUrl?: string; afterSignUpUrl?: string }) => void;
      redirectToSignIn?: (options?: { redirectUrl?: string; afterSignInUrl?: string }) => void;
      redirectToSignUp?: (options?: { redirectUrl?: string; afterSignUpUrl?: string }) => void;
      session?: {
        getToken: (options?: { template?: string }) => Promise<string | null>;
      } | null;
      signOut?: () => Promise<void>;
    };
  }
}

export function ClerkAuthPanel({
  mode,
  publishableKey,
  afterAuthUrl,
  redirectUrl
}: ClerkAuthPanelProps) {
  const [status, setStatus] = useState("Loading secure sign-in...");
  const [isReady, setIsReady] = useState(false);
  const safeRedirectUrl = useMemo(() => sanitizeRedirectUrl(redirectUrl) ?? afterAuthUrl, [
    afterAuthUrl,
    redirectUrl
  ]);

  useEffect(() => {
    if (!publishableKey) {
      setStatus("Clerk is not configured for this environment.");
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-clerk-js]");
    const script = existingScript ?? document.createElement("script");

    script.setAttribute("data-clerk-js", "true");
    script.setAttribute("data-clerk-publishable-key", publishableKey);
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5.111.0/dist/clerk.browser.js";

    script.onload = () => {
      void initializeClerk();
    };
    script.onerror = () => {
      setStatus("Unable to load Clerk. Check network access and Clerk publishable key.");
    };

    if (!existingScript) {
      document.head.appendChild(script);
    } else if (window.Clerk) {
      void initializeClerk();
    }

    async function initializeClerk() {
      try {
        await window.Clerk?.load();
        setIsReady(true);
        setStatus("Continue with Clerk to access the admin console.");

        const token = await window.Clerk?.session?.getToken();

        if (token) {
          await persistSession(token);
        }
      } catch {
        setStatus("Clerk sign-in could not be initialized.");
      }
    }
  }, [publishableKey, safeRedirectUrl]);

  async function persistSession(token: string) {
    const response = await fetch("/api/auth/clerk/session", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ token }),
      cache: "no-store"
    });

    if (!response.ok) {
      const reason = await readFailureReason(response);
      setStatus(`Signed in, but admin session could not be established. Reason: ${reason}`);
      return;
    }

    window.location.assign(safeRedirectUrl);
  }

  function openClerk() {
    if (!window.Clerk || !isReady) {
      return;
    }

    if (mode === "sign-up") {
      if (window.Clerk.redirectToSignUp) {
        window.Clerk.redirectToSignUp({
          redirectUrl: window.location.href,
          afterSignUpUrl: window.location.href
        });
        return;
      }

      window.Clerk.openSignUp({
        redirectUrl: window.location.href,
        afterSignUpUrl: window.location.href
      });
      return;
    }

    if (window.Clerk.redirectToSignIn) {
      window.Clerk.redirectToSignIn({
        redirectUrl: window.location.href,
        afterSignInUrl: window.location.href
      });
      return;
    }

    window.Clerk.openSignIn({
      redirectUrl: window.location.href,
      afterSignInUrl: window.location.href
    });
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="auth-kicker">Alpha Admin Access</p>
        <h1>{mode === "sign-up" ? "Create your admin identity" : "Sign in to Solaris AI"}</h1>
        <p className="auth-copy">{status}</p>
        <button className="auth-primary-button" type="button" onClick={openClerk} disabled={!isReady}>
          {mode === "sign-up" ? "Sign up with Clerk" : "Sign in with Clerk"}
        </button>
        <a className="auth-secondary-link" href="/admin/access">
          Local legacy access
        </a>
      </section>
    </main>
  );
}

async function readFailureReason(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const body = JSON.parse(text) as { error?: unknown; reason?: unknown };

    if (typeof body.reason === "string" && body.reason) {
      return body.reason;
    }

    return typeof body.error === "string" && body.error ? body.error : "unknown";
  } catch {
    return `http-${response.status}`;
  }
}

function sanitizeRedirectUrl(value?: string): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return undefined;
  }

  return value;
}
