import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminConsole } from "../../components/admin-console";
import { getAdminWebConfig, isValidAdminSessionCookie, verifyClerkSessionToken } from "../../lib/admin-access";

export default function AdminConversationsPage({
  searchParams
}: {
  searchParams?: {
    status?: string;
    conversationId?: string;
  };
}) {
  const config = getAdminWebConfig();
  const cookieStore = cookies();
  const legacySessionCookie = cookieStore.get(config.cookieName)?.value;
  const clerkSessionCookie = cookieStore.get(config.clerkSessionCookieName)?.value;

  if (!verifyClerkSessionToken(clerkSessionCookie) && !isValidAdminSessionCookie(legacySessionCookie)) {
    redirect(`${config.clerkSignInUrl}?redirect_url=/admin/conversations`);
  }

  const apiBaseUrl = "/api/admin";
  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo";
  const conversationFilter = searchParams?.status === "all" ? "all" : "pending_human";

  return (
    <AdminConsole
      apiBaseUrl={apiBaseUrl}
      defaultTenantSlug={tenantSlug}
      view="conversations"
      conversationFilter={conversationFilter}
      initialConversationId={searchParams?.conversationId}
      clerkPublishableKey={config.clerkPublishableKey}
    />
  );
}
