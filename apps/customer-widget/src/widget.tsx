import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  ConversationDetail,
  MessageAuthorType,
  SendChatMessageResponse,
  WidgetBootstrapOptions
} from "@platform/types";
import { persistAnonymousVisitorId, resolveAnonymousVisitorId } from "@platform/utils";

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

const secondaryButtonStyle: CSSProperties = {
  borderRadius: 999,
  padding: "12px 16px",
  background: "#ffffff",
  color: "#0f172a",
  border: "1px solid rgba(15, 23, 42, 0.16)",
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

const authorLabels: Record<MessageAuthorType, string> = {
  customer: "You",
  assistant: "Assistant",
  agent: "Support agent",
  system: "System"
};

export function CustomerWidget({
  tenantSlug,
  apiBaseUrl,
  visitorId: initialVisitorId,
  theme
}: WidgetBootstrapOptions) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [visitorId, setVisitorId] = useState<string>(initialVisitorId ?? "");
  const [error, setError] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [isRequestingHandoff, setIsRequestingHandoff] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setVisitorId(resolveAnonymousVisitorId(tenantSlug, initialVisitorId) ?? "");
    setConversation(null);
    setError(undefined);
  }, [initialVisitorId, tenantSlug]);

  const isPendingHuman = conversation?.status === "pending_human";
  const messages = conversation?.messages ?? [];

  const introCopy = useMemo(() => {
    if (!conversation) {
      return "Send a message to start a tenant-aware support conversation.";
    }

    if (isPendingHuman) {
      return "Human support is pending. Refresh this conversation to see new replies.";
    }

    return "Conversation is now persisted through the API and Prisma.";
  }, [conversation, isPendingHuman]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();

    if (!message || isSending || !visitorId || isPendingHuman) {
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
          conversationId: conversation?.id,
          visitorId
        })
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as SendChatMessageResponse;
      setConversation((current) => ({
        id: payload.conversation.id,
        status: payload.conversation.status,
        channel: payload.conversation.channel,
        createdAt: payload.conversation.createdAt,
        updatedAt: payload.conversation.updatedAt,
        lastMessageAt: payload.conversation.lastMessageAt,
        customer: current?.customer ?? {
          id: payload.customerId,
          visitorId: payload.visitorId
        },
        assignedUser: current?.assignedUser ?? null,
        handoffRequestedAt: current?.handoffRequestedAt ?? null,
        handoffReason: current?.handoffReason ?? null,
        isHandoffPending: payload.conversation.status === "pending_human",
        messages: payload.messages
      }));
      setVisitorId(persistAnonymousVisitorId(tenantSlug, payload.visitorId));
      setDraft("");
    } catch (submissionError: unknown) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to send message.");
    } finally {
      setIsSending(false);
    }
  }

  async function requestHandoff() {
    if (!conversation?.id || !visitorId || isPendingHuman || isRequestingHandoff) {
      return;
    }

    setError(undefined);
    setIsRequestingHandoff(true);

    try {
      const response = await fetch(`${apiBaseUrl}/conversations/${conversation.id}/handoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug
        },
        body: JSON.stringify({
          visitorId,
          reason: "Customer requested human support from the widget."
        })
      });

      if (!response.ok) {
        throw new Error(`Handoff request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ConversationDetail;
      setConversation(payload);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to request human support."
      );
    } finally {
      setIsRequestingHandoff(false);
    }
  }

  async function refreshConversation() {
    if (!conversation?.id || isRefreshing) {
      return;
    }

    setError(undefined);
    setIsRefreshing(true);

    try {
      const response = await fetch(`${apiBaseUrl}/conversations/${conversation.id}/detail`, {
        headers: {
          "x-tenant-slug": tenantSlug
        }
      });

      if (!response.ok) {
        throw new Error(`Conversation refresh failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ConversationDetail;
      setConversation(payload);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to refresh conversation."
      );
    } finally {
      setIsRefreshing(false);
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
          <div style={bubbleStyle}>{introCopy}</div>

          {messages.map((message) => (
            <div
              key={message.id}
              style={message.authorType === "customer" ? customerBubbleStyle : bubbleStyle}
            >
              <strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>
                {message.authorType === "agent" && message.authorName
                  ? `${authorLabels[message.authorType]} · ${message.authorName}`
                  : authorLabels[message.authorType]}
              </strong>
              <div>{message.content}</div>
              {message.citations?.length ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
                  Sources:{" "}
                  {message.citations
                    .map((citation) => `${citation.title} (chunk ${citation.chunkIndex})`)
                    .join(", ")}
                </div>
              ) : null}
              {message.messageType !== "text" ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
                  type: {message.messageType}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <textarea
            aria-label="Message"
            placeholder={isPendingHuman ? "Human support is pending." : "Ask a support question"}
            style={{
              ...textareaStyle,
              opacity: isPendingHuman ? 0.65 : 1
            }}
            value={draft}
            disabled={isPendingHuman}
            onChange={(event) => setDraft(event.target.value)}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button type="submit" style={buttonStyle} disabled={isSending || !visitorId || isPendingHuman}>
              {isSending ? "Sending..." : "Send message"}
            </button>

            <button
              type="button"
              style={secondaryButtonStyle}
              disabled={!conversation?.id || isRequestingHandoff || isPendingHuman}
              onClick={requestHandoff}
            >
              {isRequestingHandoff ? "Requesting..." : "Talk to human"}
            </button>

            <button
              type="button"
              style={secondaryButtonStyle}
              disabled={!conversation?.id || isRefreshing}
              onClick={refreshConversation}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </form>

        <div style={{ fontSize: 13, color: "#64748b" }}>
          Visitor: {visitorId || "pending"}
          {conversation?.id ? ` | Conversation: ${conversation.id}` : ""}
          {conversation?.status ? ` | Status: ${conversation.status}` : ""}
        </div>

        {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
      </div>
    </section>
  );
}
