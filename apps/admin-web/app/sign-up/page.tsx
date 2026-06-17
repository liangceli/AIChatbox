import { ClerkAuthPanel } from "../components/clerk-auth-panel";
import { getAdminWebConfig } from "../lib/admin-access";

type SignUpPageProps = {
  searchParams?: {
    redirect_url?: string;
  };
};

export default function SignUpPage({ searchParams }: SignUpPageProps) {
  const config = getAdminWebConfig();

  return (
    <ClerkAuthPanel
      mode="sign-up"
      publishableKey={config.clerkPublishableKey}
      afterAuthUrl={config.clerkAfterSignUpUrl}
      redirectUrl={searchParams?.redirect_url}
    />
  );
}
