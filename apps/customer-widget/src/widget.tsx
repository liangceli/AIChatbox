import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ConversationDetail,
  MessageAuthorType,
  PublicTenantAiProfile,
  SendChatMessageResponse,
  WidgetBootstrapOptions
} from "@platform/types";
import { persistAnonymousVisitorId, resolveAnonymousVisitorId } from "@platform/utils";

const shellStyle: CSSProperties = {
  width: 560,
  maxWidth: "100%",
  borderRadius: 28,
  overflow: "hidden",
  border: "1px solid rgba(15, 23, 42, 0.1)",
  boxShadow: "0 28px 72px rgba(15, 23, 42, 0.2)",
  background: "#f8fafc",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};

const headerStyle: CSSProperties = {
  padding: "18px 20px 20px",
  background:
    "linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 64, 175, 0.96))",
  color: "#f8fafc",
  position: "relative"
};

const headerTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12
};

const brandLockupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0
};

const avatarStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  borderRadius: 14,
  background: "rgba(255, 255, 255, 0.12)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.16)",
  objectFit: "contain",
  padding: 6
};

const avatarInitialStyle: CSSProperties = {
  ...avatarStyle,
  objectFit: undefined,
  padding: 0,
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 800
};

const titleStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 16,
  fontWeight: 760,
  letterSpacing: 0
};

const subtitleStyle: CSSProperties = {
  marginTop: 3,
  color: "rgba(248, 250, 252, 0.74)",
  fontSize: 12,
  lineHeight: 1.35
};

const statusPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  flexShrink: 0,
  borderRadius: 999,
  padding: "7px 10px",
  background: "rgba(255, 255, 255, 0.12)",
  border: "1px solid rgba(255, 255, 255, 0.16)",
  color: "#e0f2fe",
  fontSize: 12,
  fontWeight: 650
};

const statusDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "#34d399",
  boxShadow: "0 0 0 4px rgba(52, 211, 153, 0.16)"
};

const bodyStyle: CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 14,
  color: "#0f172a",
  background:
    "linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 1))"
};

const contextBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "11px 12px",
  borderRadius: 18,
  background: "#ffffff",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.06)",
  fontSize: 12,
  color: "#64748b"
};

const bubbleStyle: CSSProperties = {
  maxWidth: "86%",
  padding: "12px 14px",
  borderRadius: "18px 18px 18px 6px",
  background: "#ffffff",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  lineHeight: 1.52,
  color: "#111827",
  fontSize: 14
};

const customerBubbleStyle: CSSProperties = {
  ...bubbleStyle,
  justifySelf: "end",
  borderRadius: "18px 18px 6px 18px",
  background: "#111827",
  border: "1px solid rgba(17, 24, 39, 0.9)",
  color: "#f8fafc",
  boxShadow: "0 12px 24px rgba(17, 24, 39, 0.2)"
};

const systemBubbleStyle: CSSProperties = {
  ...bubbleStyle,
  maxWidth: "100%",
  justifySelf: "stretch",
  borderRadius: 18,
  background: "#eef6ff",
  border: "1px solid rgba(59, 130, 246, 0.14)",
  color: "#1e3a8a"
};

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: "11px 14px",
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  font: "inherit",
  fontSize: 13,
  fontWeight: 700,
  boxShadow: "0 12px 22px rgba(17, 24, 39, 0.18)"
};

const secondaryButtonStyle: CSSProperties = {
  borderRadius: 14,
  padding: "11px 13px",
  background: "#ffffff",
  color: "#0f172a",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  cursor: "pointer",
  font: "inherit",
  fontSize: 13,
  fontWeight: 700
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 96,
  padding: "13px 14px",
  borderRadius: 18,
  border: "1px solid rgba(148, 163, 184, 0.38)",
  background: "#ffffff",
  color: "#0f172a",
  resize: "vertical",
  font: "inherit",
  lineHeight: 1.45,
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)"
};

const messageListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minHeight: 360,
  maxHeight: 560,
  overflowY: "auto",
  padding: "2px 2px 4px"
};

const composerStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  borderRadius: 22,
  background: "#ffffff",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.08)"
};

const errorStyle: CSSProperties = {
  borderRadius: 14,
  padding: "10px 12px",
  background: "#fef2f2",
  border: "1px solid rgba(220, 38, 38, 0.16)",
  color: "#991b1b",
  fontSize: 13,
  lineHeight: 1.4
};

const authorLabels: Record<MessageAuthorType, string> = {
  customer: "You",
  assistant: "AI Assistant",
  agent: "Support Agent",
  system: "System"
};

export function CustomerWidget({
  tenantSlug,
  apiBaseUrl,
  visitorId: initialVisitorId,
  theme,
  initialProfile
}: WidgetBootstrapOptions & {
  initialProfile?: PublicTenantAiProfile;
}) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [visitorId, setVisitorId] = useState<string>(initialVisitorId ?? "");
  const [error, setError] = useState<string>();
  const [profile, setProfile] = useState<PublicTenantAiProfile | undefined>(initialProfile);
  const [isSending, setIsSending] = useState(false);
  const [isRequestingHandoff, setIsRequestingHandoff] = useState(false);
  const [isEndingHandoff, setIsEndingHandoff] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisitorId(resolveAnonymousVisitorId(tenantSlug, initialVisitorId) ?? "");
    setConversation(null);
    setError(undefined);
  }, [initialVisitorId, tenantSlug]);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const response = await fetch(`${apiBaseUrl}/tenant-profile`, {
          headers: {
            "x-tenant-slug": tenantSlug
          }
        });

        if (response.ok) {
          const payload = (await response.json()) as PublicTenantAiProfile;

          if (isMounted) {
            setProfile(payload);
          }
        }
      } catch {
        if (isMounted) {
          setProfile(undefined);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, tenantSlug]);

  useEffect(() => {
    if (!visitorId) {
      return;
    }

    const storedConversationId = readConversationId(tenantSlug);

    if (!storedConversationId) {
      return;
    }

    let isMounted = true;

    async function restoreConversation() {
      try {
        const response = await fetch(
          `${apiBaseUrl}/conversations/${storedConversationId}/customer-detail?visitorId=${encodeURIComponent(visitorId)}`,
          {
            headers: {
              "x-tenant-slug": tenantSlug
            }
          }
        );

        if (!response.ok) {
          if (response.status === 403 || response.status === 404) {
            removeConversationId(tenantSlug);
          }

          return;
        }

        const payload = (await response.json()) as ConversationDetail;

        if (isMounted) {
          setConversation(payload);
        }
      } catch {
        // Keep the stored conversation id so a later refresh can retry.
      }
    }

    void restoreConversation();

    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl, tenantSlug, visitorId]);

  useEffect(() => {
    if (conversation?.id) {
      persistConversationId(tenantSlug, conversation.id);
    }
  }, [conversation?.id, tenantSlug]);

  useEffect(() => {
    if (!conversation?.id) {
      return;
    }

    const events = new EventSource(
      `${apiBaseUrl}/realtime/customer-conversation?tenantSlug=${encodeURIComponent(tenantSlug)}&conversationId=${encodeURIComponent(conversation.id)}&visitorId=${encodeURIComponent(visitorId)}`
    );

    events.addEventListener("customer_conversation_snapshot", (event) => {
      const payload = JSON.parse(event.data) as {
        conversation?: ConversationDetail | null;
      };

      if (payload.conversation?.id === conversation.id) {
        setConversation(payload.conversation);
      }
    });

    events.onerror = () => {
      events.close();
    };

    return () => {
      events.close();
    };
  }, [apiBaseUrl, tenantSlug, conversation?.id, visitorId]);

  const isPendingHuman = conversation?.status === "pending_human";
  const messages = conversation?.messages ?? [];
  const statusText = isPendingHuman ? "Human pending" : conversation ? "AI online" : "Ready";
  const visitorLabel = visitorId ? visitorId.slice(0, 8) : "pending";
  const assistantName = profile?.assistantName ?? theme?.title ?? "AI Support";
  const companyDisplayName = profile?.companyDisplayName ?? tenantSlug;
  const avatarUrl = profile?.avatarUrl ?? profile?.logoUrl;
  const headerBackground =
    theme?.headerBackground ??
    (profile?.primaryColor
      ? `linear-gradient(135deg, ${profile.primaryColor}, #111827)`
      : headerStyle.background);
  const latestMessageId = messages.at(-1)?.id;

  useEffect(() => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: "smooth"
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [latestMessageId, messages.length, conversation?.status]);

  const introCopy = useMemo(() => {
    if (!conversation) {
      return profile?.welcomeMessage ?? "Hi, I can help answer questions and bring in a support agent when needed.";
    }

    if (isPendingHuman) {
      return (
        profile?.handoffMessage ??
        "A support agent is connected. You can keep messaging here or end human support when you are ready."
      );
    }

    return `I am tracking this conversation securely for ${companyDisplayName}.`;
  }, [conversation, isPendingHuman, profile?.welcomeMessage, profile?.handoffMessage, companyDisplayName]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();

    if (!message || isSending || !visitorId) {
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

  async function endHandoff() {
    if (!conversation?.id || !visitorId || !isPendingHuman || isEndingHandoff) {
      return;
    }

    setError(undefined);
    setIsEndingHandoff(true);

    try {
      const response = await fetch(`${apiBaseUrl}/conversations/${conversation.id}/handoff/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug
        },
        body: JSON.stringify({
          visitorId,
          reason: "Customer ended human support from the widget."
        })
      });

      if (!response.ok) {
        throw new Error(`End handoff request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ConversationDetail;
      setConversation(payload);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to end human support."
      );
    } finally {
      setIsEndingHandoff(false);
    }
  }

  async function loadConversationDetail(conversationId: string) {
    try {
      const response = await fetch(
        `${apiBaseUrl}/conversations/${conversationId}/customer-detail?visitorId=${encodeURIComponent(visitorId)}`,
        {
        headers: {
          "x-tenant-slug": tenantSlug
        }
        }
      );

      if (!response.ok) {
        throw new Error(`Conversation refresh failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ConversationDetail;
      setConversation(payload);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to refresh conversation."
      );
    }
  }

  return (
    <section style={shellStyle} aria-label="Customer support chat widget">
      <header
        style={{
          ...headerStyle,
          background: headerBackground
        }}
      >
        <div style={headerTopStyle}>
          <div style={brandLockupStyle}>
            {avatarUrl ? (
              <img style={avatarStyle} src={avatarUrl} alt="" aria-hidden="true" />
            ) : (
              <span style={avatarInitialStyle} aria-hidden="true">
                {getInitials(assistantName)}
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <strong style={titleStyle}>{assistantName}</strong>
              <div style={subtitleStyle}>{companyDisplayName}</div>
            </div>
          </div>

          <div style={statusPillStyle}>
            <span style={statusDotStyle} aria-hidden="true" />
            {statusText}
          </div>
        </div>
      </header>

      <div style={bodyStyle}>
        <div style={contextBarStyle}>
          <span>Workspace: {companyDisplayName}</span>
          <span>Visitor: {visitorLabel}</span>
        </div>

        <div ref={messageListRef} style={messageListStyle}>
          <div style={systemBubbleStyle}>{introCopy}</div>

          {messages.map((message) => {
            const isCustomer = message.authorType === "customer";

            return (
              <div key={message.id} style={isCustomer ? customerBubbleStyle : bubbleStyle}>
                <strong
                  style={{
                    display: "block",
                    marginBottom: 5,
                    fontSize: 12,
                    color: isCustomer ? "#cbd5e1" : "#475569"
                  }}
                >
                  {message.authorType === "agent" && message.authorName
                    ? `${authorLabels[message.authorType]} - ${message.authorName}`
                    : authorLabels[message.authorType]}
                </strong>
                <div>{message.content}</div>
                {message.citations?.length ? (
                  <div
                    style={{
                      marginTop: 9,
                      paddingTop: 8,
                      borderTop: "1px solid rgba(148, 163, 184, 0.22)",
                      fontSize: 12,
                      color: isCustomer ? "#cbd5e1" : "#475569"
                    }}
                  >
                    <strong style={{ display: "block", marginBottom: 4 }}>Sources</strong>
                    {message.citations.map((citation) => (
                      <div key={`${citation.chunkId}-${citation.chunkIndex}`}>
                        {citation.title} - chunk {citation.chunkIndex}
                        {citation.sourceUri ? ` - ${citation.sourceUri}` : ""}
                      </div>
                    ))}
                  </div>
                ) : null}
                {message.messageType !== "text" ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                    type: {message.messageType}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} style={composerStyle}>
          <textarea
            aria-label="Message"
            placeholder={
              isPendingHuman ? "Message the support agent..." : "Type your question..."
            }
            style={{
              ...textareaStyle,
              opacity: 1
            }}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <button
              type="submit"
              style={{
                ...buttonStyle,
                opacity: isSending || !visitorId ? 0.56 : 1,
                cursor: isSending || !visitorId ? "not-allowed" : "pointer"
              }}
              disabled={isSending || !visitorId}
            >
              {isSending ? "Sending..." : "Send message"}
            </button>

            {isPendingHuman ? (
              <button
                type="button"
                style={{
                  ...secondaryButtonStyle,
                  opacity: !conversation?.id || isEndingHandoff ? 0.56 : 1,
                  cursor: !conversation?.id || isEndingHandoff ? "not-allowed" : "pointer"
                }}
                disabled={!conversation?.id || isEndingHandoff}
                onClick={endHandoff}
              >
                {isEndingHandoff ? "..." : "End human"}
              </button>
            ) : (
              <button
                type="button"
                style={{
                  ...secondaryButtonStyle,
                  opacity: !conversation?.id || isRequestingHandoff ? 0.56 : 1,
                  cursor: !conversation?.id || isRequestingHandoff ? "not-allowed" : "pointer"
                }}
                disabled={!conversation?.id || isRequestingHandoff}
                onClick={requestHandoff}
              >
                {isRequestingHandoff ? "..." : "Human"}
              </button>
            )}

          </div>
        </form>

        {conversation?.id ? (
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
            Conversation: {conversation.id} | Status: {conversation.status}
          </div>
        ) : null}

        {error ? <div style={errorStyle}>{error}</div> : null}
      </div>
    </section>
  );
}

function getInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "AI";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getConversationStorageKey(tenantSlug: string): string {
  return `customer-widget:${tenantSlug}:conversation-id`;
}

function readConversationId(tenantSlug: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(getConversationStorageKey(tenantSlug));
}

function persistConversationId(tenantSlug: string, conversationId: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(getConversationStorageKey(tenantSlug), conversationId);
  }
}

function removeConversationId(tenantSlug: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(getConversationStorageKey(tenantSlug));
  }
}
