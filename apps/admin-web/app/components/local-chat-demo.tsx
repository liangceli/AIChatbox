"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ConversationDetail,
  MessageAuthorType,
  SendChatMessageResponse
} from "@platform/types";
import { persistAnonymousVisitorId, resolveAnonymousVisitorId } from "@platform/utils";

const shellStyle = {
  display: "grid",
  gap: "14px"
} as const;

const messageStyle = {
  maxWidth: "88%",
  padding: "12px 14px",
  borderRadius: "18px 18px 18px 6px",
  background: "#ffffff",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  color: "#0f172a",
  lineHeight: 1.5
} as const;

const customerMessageStyle = {
  ...messageStyle,
  justifySelf: "end",
  borderRadius: "18px 18px 6px 18px",
  background: "#111827",
  border: "1px solid rgba(17, 24, 39, 0.9)",
  color: "#f8fafc"
} as const;

const controlButtonStyle = {
  alignSelf: "start",
  border: 0,
  borderRadius: "14px",
  padding: "11px 14px",
  background: "#111827",
  color: "#ffffff",
  cursor: "pointer",
  font: "inherit",
  fontSize: "0.9rem",
  fontWeight: 700,
  boxShadow: "0 12px 22px rgba(17, 24, 39, 0.14)"
} as const;

const secondaryButtonStyle = {
  ...controlButtonStyle,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "none"
} as const;

const authorLabels: Record<MessageAuthorType, string> = {
  customer: "Customer",
  assistant: "Assistant",
  agent: "Agent",
  system: "System"
};

export function LocalChatDemo({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  const [visitorId, setVisitorId] = useState<string>();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRequestingHandoff, setIsRequestingHandoff] = useState(false);
  const [isEndingHandoff, setIsEndingHandoff] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setVisitorId(resolveAnonymousVisitorId(tenantSlug) ?? undefined);
    setConversation(null);
    setError(undefined);
  }, [tenantSlug]);

  const messages = conversation?.messages ?? [];
  const isPendingHuman =
    conversation?.status === "pending_human" || conversation?.status === "assigned";

  const summaryText = useMemo(() => {
    if (!conversation) {
      return "Send one message to verify tenant resolution, knowledge answers, and handoff flow.";
    }

    if (isPendingHuman) {
      return "Human support is active. Customer messages are saved for the agent and AI stays paused until human support ends.";
    }

    return "Conversation is persisted through the API and Prisma.";
  }, [conversation, isPendingHuman]);

  async function sendMessage() {
    const message = draft.trim();

    if (!message || isSending || !visitorId) {
      return;
    }

    setIsSending(true);
    setError(undefined);

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
        throw new Error(`Chat API returned ${response.status}`);
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
        isHandoffPending:
          payload.conversation.status === "pending_human" ||
          payload.conversation.status === "assigned",
        messages: payload.messages
      }));
      setVisitorId(persistAnonymousVisitorId(tenantSlug, payload.visitorId));
      setDraft("");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send message.");
    } finally {
      setIsSending(false);
    }
  }

  async function refreshConversation() {
    if (!conversation?.id || !visitorId) {
      return;
    }

    setIsRefreshing(true);
    setError(undefined);

    try {
      const response = await fetch(
        `${apiBaseUrl}/conversations/${conversation.id}/customer-detail?visitorId=${encodeURIComponent(visitorId)}`,
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
    } finally {
      setIsRefreshing(false);
    }
  }

  async function requestHandoff() {
    if (!conversation?.id || !visitorId || isRequestingHandoff || isPendingHuman) {
      return;
    }

    setIsRequestingHandoff(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/conversations/${conversation.id}/handoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug
        },
        body: JSON.stringify({
          visitorId,
          reason: "Customer requested human support from the local demo."
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

    setIsEndingHandoff(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/conversations/${conversation.id}/handoff/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug
        },
        body: JSON.stringify({
          visitorId,
          reason: "Customer ended human support from the local demo."
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

  return (
    <section style={shellStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px"
        }}
      >
        <div>
          <strong>Local chat demo</strong>
          <div style={{ color: "#64748b", fontSize: "0.92rem", marginTop: 6 }}>
            Tenant header: {tenantSlug}
          </div>
        </div>
        <span
          style={{
            borderRadius: "999px",
            padding: "7px 10px",
            background: isPendingHuman ? "#fff7ed" : "#ecfdf5",
            border: isPendingHuman
              ? "1px solid rgba(249, 115, 22, 0.16)"
              : "1px solid rgba(16, 185, 129, 0.16)",
            color: isPendingHuman ? "#9a3412" : "#047857",
            fontSize: "0.78rem",
            fontWeight: 700,
            whiteSpace: "nowrap"
          }}
        >
          {isPendingHuman ? "Human pending" : conversation ? "AI online" : "Ready"}
        </span>
      </div>

      <div
        style={{
          borderRadius: "18px",
          padding: "11px 12px",
          background: "#f8fafc",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          color: "#64748b",
          fontSize: "0.9rem",
          lineHeight: 1.45
        }}
      >
        {summaryText}
        <div style={{ marginTop: 4 }}>Visitor: {visitorId ?? "initializing..."}</div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "10px",
          maxHeight: "340px",
          overflowY: "auto",
          padding: "2px"
        }}
      >
        {messages.length === 0 ? <div style={messageStyle}>{summaryText}</div> : null}

        {messages.map((message) => (
          <div
            key={message.id}
            style={message.authorType === "customer" ? customerMessageStyle : messageStyle}
          >
            <strong
              style={{
                display: "block",
                marginBottom: 5,
                color: message.authorType === "customer" ? "#cbd5e1" : "#475569",
                fontSize: "0.78rem"
              }}
            >
              {message.authorType === "agent" && message.authorName
                ? `${authorLabels[message.authorType]} - ${message.authorName}`
                : authorLabels[message.authorType]}
            </strong>
            <div>{message.content}</div>
            {message.citations?.length ? (
              <div style={{ marginTop: 8, fontSize: "0.82rem", color: "#64748b" }}>
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
              <div style={{ marginTop: 6, fontSize: "0.8rem", color: "#64748b" }}>
                type: {message.messageType}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={isPendingHuman ? "Message the support agent" : "Ask a support question"}
        style={{
          minHeight: "92px",
          borderRadius: "18px",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          background: "#ffffff",
          padding: "13px 14px",
          font: "inherit",
          lineHeight: 1.45,
          outline: "none",
          opacity: 1
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <button
          type="button"
          onClick={sendMessage}
          disabled={isSending || !visitorId}
          style={controlButtonStyle}
        >
          {isSending ? "Sending..." : "Send test message"}
        </button>

        {isPendingHuman ? (
          <button
            type="button"
            onClick={endHandoff}
            disabled={!conversation?.id || isEndingHandoff}
            style={secondaryButtonStyle}
          >
            {isEndingHandoff ? "Ending..." : "End human support"}
          </button>
        ) : (
          <button
            type="button"
            onClick={requestHandoff}
            disabled={!conversation?.id || isRequestingHandoff}
            style={secondaryButtonStyle}
          >
            {isRequestingHandoff ? "Requesting..." : "Talk to human"}
          </button>
        )}

        <button
          type="button"
          onClick={refreshConversation}
          disabled={!conversation?.id || isRefreshing}
          style={secondaryButtonStyle}
        >
          {isRefreshing ? "Refreshing..." : "Refresh conversation"}
        </button>
      </div>

      {conversation ? (
        <div style={{ color: "#64748b", fontSize: "0.88rem", display: "grid", gap: "4px" }}>
          <div>Conversation ID: {conversation.id}</div>
          <div>Status: {conversation.status}</div>
          {conversation.handoffRequestedAt ? (
            <div>Handoff requested: {new Date(conversation.handoffRequestedAt).toLocaleString()}</div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            borderRadius: "14px",
            padding: "10px 12px",
            background: "#fef2f2",
            border: "1px solid rgba(220, 38, 38, 0.16)",
            color: "#991b1b"
          }}
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
