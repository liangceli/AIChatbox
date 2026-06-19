export async function refreshClerkSession(publishableKey?: string): Promise<boolean> {
  if (!publishableKey) {
    return false;
  }

  const clerk = await waitForClerkClient();
  const token = await clerk.session?.getToken();

  if (!token) {
    return false;
  }

  const response = await fetch("/api/auth/clerk/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store"
  });

  return response.ok;
}

export function redirectToSignIn(): void {
  const redirectUrl = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
}

export async function signOutToHome(publishableKey?: string): Promise<void> {
  try {
    if (publishableKey) {
      const clerk = await waitForClerkClient();
      await clerk.signOut?.();
    }
  } finally {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.assign("/");
  }
}

async function waitForClerkClient(): Promise<ClerkBrowserClient> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (window.Clerk) return window.Clerk;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  throw new Error("Clerk did not initialize.");
}
