import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AgentConsole } from "../components/agent-console";
import { getAdminWebConfig, isValidAdminSessionCookie } from "../lib/admin-access";

export default function AgentPage() {
  const config = getAdminWebConfig();
  const sessionCookie = cookies().get(config.cookieName)?.value;

  if (!isValidAdminSessionCookie(sessionCookie)) {
    redirect("/admin/access?next=/agent");
  }

  const apiBaseUrl = "/api/admin";
  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "kasta";

  return <AgentConsole apiBaseUrl={apiBaseUrl} tenantSlug={tenantSlug} />;
}
