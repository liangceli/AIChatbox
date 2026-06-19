interface ClerkBrowserClient {
  signOut?: () => Promise<void>;
  user?: {
    primaryEmailAddress?: { emailAddress?: string } | null;
    emailAddresses?: Array<{ emailAddress?: string }>;
  } | null;
  session?: {
    getToken: (options?: { template?: string }) => Promise<string | null>;
  } | null;
}

interface Window {
  Clerk?: ClerkBrowserClient;
}
