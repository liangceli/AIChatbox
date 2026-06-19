import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StandaloneAccount } from "../components/standalone-account";
import { getAdminWebConfig, verifyClerkSessionToken } from "../lib/admin-access";

export default function AccountPage() {
  const config = getAdminWebConfig();
  const token = cookies().get(config.clerkSessionCookieName)?.value;

  if (!verifyClerkSessionToken(token)) {
    redirect(`${config.clerkSignInUrl}?redirect_url=/account`);
  }

  return <StandaloneAccount clerkPublishableKey={config.clerkPublishableKey} />;
}
