import { AgentConsole } from "../components/agent-console";

export default function AgentPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";
  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "kasta";

  return <AgentConsole apiBaseUrl={apiBaseUrl} tenantSlug={tenantSlug} />;
}
