import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccessPendingPanel } from "../components/access-pending-panel";
import { getAdminWebConfig, verifyClerkSessionToken } from "../lib/admin-access";

export default function AccessPendingPage() {
  const config = getAdminWebConfig();
  const token = cookies().get(config.clerkSessionCookieName)?.value;

  if (!verifyClerkSessionToken(token)) {
    redirect(`${config.clerkSignInUrl}?redirect_url=/access-pending`);
  }

  return <AccessPendingPanel />;
}
