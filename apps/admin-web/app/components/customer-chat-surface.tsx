"use client";

import { CustomerWidget } from "@platform/customer-widget";

export function CustomerChatSurface({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  return (
    <main className="chat-page">
      <section className="chat-frame">
        <CustomerWidget
          apiBaseUrl={apiBaseUrl}
          tenantSlug={tenantSlug}
          theme={{
            title: "Support"
          }}
        />
      </section>
    </main>
  );
}
