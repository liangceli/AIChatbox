"use client";

import { CustomerWidget } from "@platform/customer-widget";
import type { PublicTenantAiProfile } from "@platform/types";

export function CustomerChatSurface({
  apiBaseUrl,
  tenantSlug,
  initialProfile
}: {
  apiBaseUrl: string;
  tenantSlug: string;
  initialProfile?: PublicTenantAiProfile;
}) {
  return (
    <main className="chat-page">
      <section className="chat-frame">
        <CustomerWidget
          apiBaseUrl={apiBaseUrl}
          tenantSlug={tenantSlug}
          initialProfile={initialProfile}
          theme={{
            title: "Support"
          }}
        />
      </section>
    </main>
  );
}
