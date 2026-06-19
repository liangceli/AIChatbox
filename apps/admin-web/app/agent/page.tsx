import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AgentConsole } from "../components/agent-console";
import { getAdminWebConfig, isAdminWebSessionAuthenticated } from "../lib/admin-access";

export default function AgentPage() {
  const config = getAdminWebConfig();
  const cookieStore = cookies();
  const legacySessionCookie = cookieStore.get(config.cookieName)?.value;
  const clerkSessionCookie = cookieStore.get(config.clerkSessionCookieName)?.value;

  if (!isAdminWebSessionAuthenticated(clerkSessionCookie, legacySessionCookie)) {
    redirect(`${config.clerkSignInUrl}?redirect_url=/agent`);
  }

  const apiBaseUrl = "/api/admin";
  return <AgentConsole apiBaseUrl={apiBaseUrl} clerkPublishableKey={config.clerkPublishableKey} />;
}
