import { CustomerChatSurface } from "../components/customer-chat-surface";
import type { PublicTenantAiProfile } from "@platform/types";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";
  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo";
  const initialProfile = await loadTenantProfile(apiBaseUrl, tenantSlug);

  return (
    <CustomerChatSurface
      apiBaseUrl={apiBaseUrl}
      tenantSlug={tenantSlug}
      initialProfile={initialProfile}
    />
  );
}

async function loadTenantProfile(
  apiBaseUrl: string,
  tenantSlug: string
): Promise<PublicTenantAiProfile | undefined> {
  try {
    const response = await fetch(`${apiBaseUrl}/tenant-profile`, {
      cache: "no-store",
      headers: {
        "x-tenant-slug": tenantSlug
      }
    });

    return response.ok ? ((await response.json()) as PublicTenantAiProfile) : undefined;
  } catch {
    return undefined;
  }
}
