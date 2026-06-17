import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AgentConsole } from "../components/agent-console";
import { getAdminWebConfig, isValidAdminSessionCookie, verifyClerkSessionToken } from "../lib/admin-access";

export default function AgentPage() {
  const config = getAdminWebConfig();
  const cookieStore = cookies();
  const legacySessionCookie = cookieStore.get(config.cookieName)?.value;
  const clerkSessionCookie = cookieStore.get(config.clerkSessionCookieName)?.value;

  if (!verifyClerkSessionToken(clerkSessionCookie) && !isValidAdminSessionCookie(legacySessionCookie)) {
    redirect(`${config.clerkSignInUrl}?redirect_url=/agent`);
  }

  const apiBaseUrl = "/api/admin";
  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo";

  return <AgentConsole apiBaseUrl={apiBaseUrl} tenantSlug={tenantSlug} />;
}
