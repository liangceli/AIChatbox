import type { CSSProperties } from "react";
import type { WidgetBootstrapOptions } from "@platform/types";

const shellStyle: CSSProperties = {
  width: 360,
  maxWidth: "100%",
  borderRadius: 24,
  overflow: "hidden",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 22px 48px rgba(15, 23, 42, 0.12)",
  background: "#ffffff",
  fontFamily: "\"Trebuchet MS\", \"Segoe UI\", sans-serif"
};

const headerStyle: CSSProperties = {
  padding: "16px 18px",
  background: "linear-gradient(135deg, #0f172a, #1d4ed8)",
  color: "#f8fafc"
};

const bodyStyle: CSSProperties = {
  padding: 18,
  display: "grid",
  gap: 14,
  color: "#0f172a"
};

const bubbleStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "#eff6ff",
  lineHeight: 1.5
};

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 999,
  padding: "12px 16px",
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer"
};

export function CustomerWidget({
  tenantSlug,
  apiBaseUrl,
  theme
}: WidgetBootstrapOptions) {
  return (
    <section style={shellStyle} aria-label="Customer support chat widget">
      <header
        style={{
          ...headerStyle,
          background: theme?.headerBackground ?? headerStyle.background
        }}
      >
        <strong>{theme?.title ?? "Ask support"}</strong>
        <div style={{ fontSize: 13, opacity: 0.82 }}>
          Tenant: {tenantSlug} · API: {apiBaseUrl}
        </div>
      </header>

      <div style={bodyStyle}>
        <div style={bubbleStyle}>
          This widget package is intentionally lightweight. It provides a reusable mount point and UI shell
          for tenant-aware customer support experiences.
        </div>

        <div style={{ fontSize: 14, color: "#475569" }}>
          Future steps: live conversation state, citations, streaming responses, and handoff actions.
        </div>

        <button type="button" style={buttonStyle}>
          Start conversation
        </button>
      </div>
    </section>
  );
}
