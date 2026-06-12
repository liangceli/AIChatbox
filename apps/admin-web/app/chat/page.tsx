import { CustomerChatSurface } from "../components/customer-chat-surface";

export default function ChatPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";
  const tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? "demo";

  return <CustomerChatSurface apiBaseUrl={apiBaseUrl} tenantSlug={tenantSlug} />;
}
