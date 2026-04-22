import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  ChatMessageRecord,
  SendChatMessageResponse,
  WidgetBootstrapOptions
} from "@platform/types";

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

const customerBubbleStyle: CSSProperties = {
  ...bubbleStyle,
  justifySelf: "end",
  background: "#0f172a",
  color: "#f8fafc"
};

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 999,
  padding: "12px 16px",
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer"
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 88,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.5)",
  resize: "vertical",
  font: "inherit"
};

const messageListStyle: CSSProperties = {
  display: "grid",
  gap: 10
};

function createVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `visitor-${Date.now()}`;
}

export function CustomerWidget({
  tenantSlug,
  apiBaseUrl,
  visitorId: initialVisitorId,
  theme
}: WidgetBootstrapOptions) {
  const storageKey = useMemo(() => `customer-widget:${tenantSlug}:visitor-id`, [tenantSlug]);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [visitorId, setVisitorId] = useState<string>(initialVisitorId ?? "");
  const [error, setError] = useState<string>();
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (initialVisitorId) {
      setVisitorId(initialVisitorId);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const storedVisitorId = window.localStorage.getItem(storageKey);
    const nextVisitorId = storedVisitorId ?? createVisitorId();

    window.localStorage.setItem(storageKey, nextVisitorId);
    setVisitorId(nextVisitorId);
  }, [initialVisitorId, storageKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();

    if (!message || isSending) {
      return;
    }

    setError(undefined);
    setIsSending(true);

    try {
      const response = await fetch(`${apiBaseUrl}/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug
        },
        body: JSON.stringify({
          message,
          conversationId,
          visitorId
        })
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as SendChatMessageResponse;
      setConversationId(payload.conversation.id);
      setMessages(payload.messages);
      setVisitorId(payload.visitorId);
      setDraft("");

      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, payload.visitorId);
      }
    } catch (submissionError: unknown) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to send message.");
    } finally {
      setIsSending(false);
    }
  }

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
          Tenant: {tenantSlug} | API: {apiBaseUrl}
        </div>
      </header>

      <div style={bodyStyle}>
        <div style={messageListStyle}>
          <div style={bubbleStyle}>
            {messages.length === 0
              ? "Send a message to start a tenant-aware support conversation."
              : "Conversation is now persisted through the API and Prisma."}
          </div>

          {messages.map((message) => (
            <div
              key={message.id}
              style={message.authorType === "customer" ? customerBubbleStyle : bubbleStyle}
            >
              <strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>
                {message.authorType === "customer" ? "You" : "Assistant"}
              </strong>
              <div>{message.content}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <textarea
            aria-label="Message"
            placeholder="Ask a support question"
            style={textareaStyle}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />

          <button type="submit" style={buttonStyle} disabled={isSending}>
            {isSending ? "Sending..." : "Send message"}
          </button>
        </form>

        <div style={{ fontSize: 13, color: "#64748b" }}>
          Visitor: {visitorId || "pending"}
          {conversationId ? ` | Conversation: ${conversationId}` : ""}
        </div>

        {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
      </div>
    </section>
  );
}
