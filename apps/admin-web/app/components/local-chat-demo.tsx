"use client";

import { useEffect, useState } from "react";
import type { ChatMessageRecord, SendChatMessageResponse } from "@platform/types";
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

export function LocalChatDemo({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  const [visitorId, setVisitorId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setVisitorId(resolveAnonymousVisitorId(tenantSlug) ?? undefined);
    setConversationId(undefined);
    setMessages([]);
    setError(undefined);
  }, [tenantSlug]);

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
          conversationId,
          visitorId
        })
      });

      if (!response.ok) {
        throw new Error(`Chat API returned ${response.status}`);
      }

      const payload = (await response.json()) as SendChatMessageResponse;
      setMessages(payload.messages);
      setConversationId(payload.conversation.id);
      setVisitorId(persistAnonymousVisitorId(tenantSlug, payload.visitorId));
      setDraft("");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section style={shellStyle}>
      <div>
        <strong>Local chat demo</strong>
        <div style={{ color: "#6e5f53", fontSize: "0.95rem", marginTop: 6 }}>
          Tenant header: {tenantSlug} | Visitor: {visitorId ?? "initializing..."}
        </div>
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {messages.length === 0 ? (
          <div style={messageStyle}>Send one message to verify tenant resolution and persistence.</div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            style={message.authorType === "customer" ? customerMessageStyle : messageStyle}
          >
            <strong style={{ display: "block", marginBottom: 4 }}>
              {message.authorType === "customer" ? "You" : "Assistant"}
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
          </div>
        ))}
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Ask a support question"
        style={{
          minHeight: "96px",
          borderRadius: "16px",
          border: "1px solid rgba(62, 44, 31, 0.12)",
          padding: "12px",
          font: "inherit"
        }}
      />

      <button
        type="button"
        onClick={sendMessage}
        disabled={isSending || !visitorId}
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

      {conversationId ? (
        <div style={{ color: "#6e5f53", fontSize: "0.95rem" }}>Conversation ID: {conversationId}</div>
      ) : null}

      {error ? <div style={{ color: "#b42318" }}>{error}</div> : null}
    </section>
  );
}
