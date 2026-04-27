import { AdminConsole } from "../components/admin-console";

export default function AdminPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";
  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "kasta";

  return <AdminConsole apiBaseUrl={apiBaseUrl} defaultTenantSlug={tenantSlug} />;
}
