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
  gap: "16px"
} as const;

const messageStyle = {
  padding: "12px 14px",
  borderRadius: "16px",
  background: "#f6efe7",
  color: "#231a14"
} as const;

const customerMessageStyle = {
  ...messageStyle,
  background: "#b85c38",
  color: "#fffaf6"
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setVisitorId(resolveAnonymousVisitorId(tenantSlug) ?? undefined);
    setConversation(null);
    setError(undefined);
  }, [tenantSlug]);

  const messages = conversation?.messages ?? [];
  const isPendingHuman = conversation?.status === "pending_human";

  const summaryText = useMemo(() => {
    if (!conversation) {
      return "Send one message to verify tenant resolution, knowledge answers, and handoff flow.";
    }

    if (isPendingHuman) {
      return "Human handoff is pending. Refresh to check for an agent reply.";
    }

    return "Conversation is persisted through the API and Prisma.";
  }, [conversation, isPendingHuman]);

  async function sendMessage() {
    const message = draft.trim();

    if (!message || isSending || !visitorId || isPendingHuman) {
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
        isHandoffPending: payload.conversation.status === "pending_human",
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
    if (!conversation?.id) {
      return;
    }

    setIsRefreshing(true);
    setError(undefined);

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

  return (
    <section style={shellStyle}>
      <div>
        <strong>Local chat demo</strong>
        <div style={{ color: "#6e5f53", fontSize: "0.95rem", marginTop: 6 }}>
          Tenant header: {tenantSlug} | Visitor: {visitorId ?? "initializing..."}
        </div>
        <div style={{ color: "#6e5f53", fontSize: "0.95rem", marginTop: 4 }}>{summaryText}</div>
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {messages.length === 0 ? <div style={messageStyle}>{summaryText}</div> : null}

        {messages.map((message) => (
          <div
            key={message.id}
            style={message.authorType === "customer" ? customerMessageStyle : messageStyle}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>
              {message.authorType === "agent" && message.authorName
                ? `${authorLabels[message.authorType]} · ${message.authorName}`
                : authorLabels[message.authorType]}
            </strong>
            <div>{message.content}</div>
            {message.citations?.length ? (
              <div style={{ marginTop: 6, fontSize: "0.9rem", color: "#6e5f53" }}>
                Sources:{" "}
                {message.citations
                  .map((citation) => `${citation.title} (chunk ${citation.chunkIndex})`)
                  .join(", ")}
              </div>
            ) : null}
            {message.messageType !== "text" ? (
              <div style={{ marginTop: 6, fontSize: "0.85rem", color: "#6e5f53" }}>
                type: {message.messageType}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={isPendingHuman ? "Human support is pending." : "Ask a support question"}
        disabled={isPendingHuman}
        style={{
          minHeight: "96px",
          borderRadius: "16px",
          border: "1px solid rgba(62, 44, 31, 0.12)",
          padding: "12px",
          font: "inherit",
          opacity: isPendingHuman ? 0.65 : 1
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <button
          type="button"
          onClick={sendMessage}
          disabled={isSending || !visitorId || isPendingHuman}
          style={{
            alignSelf: "start",
            border: 0,
            borderRadius: "999px",
            padding: "12px 16px",
            background: "#231a14",
            color: "#fffaf6",
            cursor: "pointer"
          }}
        >
          {isSending ? "Sending..." : "Send test message"}
        </button>

        <button
          type="button"
          onClick={requestHandoff}
          disabled={!conversation?.id || isRequestingHandoff || isPendingHuman}
          style={{
            alignSelf: "start",
            border: "1px solid rgba(35, 26, 20, 0.2)",
            borderRadius: "999px",
            padding: "12px 16px",
            background: "#fffaf6",
            color: "#231a14",
            cursor: "pointer"
          }}
        >
          {isRequestingHandoff ? "Requesting..." : "Talk to human"}
        </button>

        <button
          type="button"
          onClick={refreshConversation}
          disabled={!conversation?.id || isRefreshing}
          style={{
            alignSelf: "start",
            border: "1px solid rgba(35, 26, 20, 0.2)",
            borderRadius: "999px",
            padding: "12px 16px",
            background: "#fffaf6",
            color: "#231a14",
            cursor: "pointer"
          }}
        >
          {isRefreshing ? "Refreshing..." : "Refresh conversation"}
        </button>
      </div>

      {conversation ? (
        <div style={{ color: "#6e5f53", fontSize: "0.95rem", display: "grid", gap: "4px" }}>
          <div>Conversation ID: {conversation.id}</div>
          <div>Status: {conversation.status}</div>
          {conversation.handoffRequestedAt ? (
            <div>Handoff requested: {new Date(conversation.handoffRequestedAt).toLocaleString()}</div>
          ) : null}
        </div>
      ) : null}

      {error ? <div style={{ color: "#b42318" }}>{error}</div> : null}
    </section>
  );
}
