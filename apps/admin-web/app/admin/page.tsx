import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminConsole } from "../components/admin-console";
import { getAdminWebConfig, isValidAdminSessionCookie } from "../lib/admin-access";

export default function AdminPage() {
  const config = getAdminWebConfig();
  const sessionCookie = cookies().get(config.cookieName)?.value;

  if (!isValidAdminSessionCookie(sessionCookie)) {
    redirect("/admin/access?next=/admin");
  }

  const apiBaseUrl = "/api/admin";
  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo";

  return <AdminConsole apiBaseUrl={apiBaseUrl} defaultTenantSlug={tenantSlug} />;
}
