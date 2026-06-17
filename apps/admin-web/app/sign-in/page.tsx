import { ClerkAuthPanel } from "../components/clerk-auth-panel";
import { getAdminWebConfig } from "../lib/admin-access";

type SignInPageProps = {
  searchParams?: {
    redirect_url?: string;
  };
};

export default function SignInPage({ searchParams }: SignInPageProps) {
  const config = getAdminWebConfig();

  return (
    <ClerkAuthPanel
      mode="sign-in"
      publishableKey={config.clerkPublishableKey}
      afterAuthUrl={config.clerkAfterSignInUrl}
      redirectUrl={searchParams?.redirect_url}
    />
  );
}
