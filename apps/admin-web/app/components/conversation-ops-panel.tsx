"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  ConversationDetail,
  ConversationListItem,
  MessageAuthorType,
  SupportUserRecord
} from "@platform/types";

const filterOptions = [
  { label: "Pending human", value: "pending_human" },
  { label: "Open", value: "open" },
  { label: "Awaiting customer", value: "awaiting_customer" },
  { label: "All", value: "all" }
] as const;

const authorLabels: Record<MessageAuthorType, string> = {
  customer: "Customer",
  assistant: "Assistant",
  agent: "Agent",
  system: "System"
};

export function ConversationOpsPanel({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  const [filter, setFilter] = useState<string>("pending_human");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [supportUsers, setSupportUsers] = useState<SupportUserRecord[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>();
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [replyDraft, setReplyDraft] = useState("");
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  useEffect(() => {
    void loadSupportUsers();
  }, [tenantSlug]);

  useEffect(() => {
    void loadConversations(filter);
  }, [filter, tenantSlug]);

  useEffect(() => {
    if (!selectedConversationId) {
      setConversationDetail(null);
      return;
    }

    void loadConversationDetail(selectedConversationId);
  }, [selectedConversationId, tenantSlug]);

  useEffect(() => {
    if (conversationDetail?.assignedUser?.id) {
      setSelectedUserId(conversationDetail.assignedUser.id);
      return;
    }

    if (supportUsers[0]?.id) {
      setSelectedUserId((current) => current || supportUsers[0]!.id);
    }
  }, [conversationDetail?.assignedUser?.id, supportUsers]);

  const selectedUser = useMemo(
    () => supportUsers.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, supportUsers]
  );

  async function loadSupportUsers() {
    try {
      const response = await fetch(`${apiBaseUrl}/conversations/support-users`, {
        headers: {
          "x-tenant-slug": tenantSlug
        }
      });

      if (!response.ok) {
        throw new Error(`Support user request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as SupportUserRecord[];
      setSupportUsers(payload);
      setSelectedUserId((current) => current || payload[0]?.id || "");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load support users.");
    }
  }

  async function loadConversations(nextFilter: string) {
    setIsLoading(true);
    setError(undefined);

    try {
      const query =
        nextFilter && nextFilter !== "all"
          ? `?status=${encodeURIComponent(nextFilter)}`
          : "";
      const response = await fetch(`${apiBaseUrl}/conversations${query}`, {
        headers: {
          "x-tenant-slug": tenantSlug
        }
      });

      if (!response.ok) {
        throw new Error(`Conversation list request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ConversationListItem[];
      setConversations(payload);
      setSelectedConversationId((current) =>
        current && payload.some((conversation) => conversation.id === current)
          ? current
          : payload[0]?.id
      );
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to load conversations."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadConversationDetail(conversationId: string) {
    try {
      const response = await fetch(`${apiBaseUrl}/conversations/${conversationId}/detail`, {
        headers: {
          "x-tenant-slug": tenantSlug
        }
      });

      if (!response.ok) {
        throw new Error(`Conversation detail request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ConversationDetail;
      setConversationDetail(payload);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to load conversation detail."
      );
    }
  }

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!conversationDetail?.id || !selectedUserId) {
      return;
    }

    setIsAssigning(true);
    setError(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/conversations/${conversationDetail.id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug
        },
        body: JSON.stringify({
          userId: selectedUserId
        })
      });

      if (!response.ok) {
        throw new Error(`Conversation assignment failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ConversationDetail;
      setConversationDetail(payload);
      await loadConversations(filter);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to assign conversation."
      );
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleAgentReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!conversationDetail?.id || !selectedUserId || !replyDraft.trim()) {
      return;
    }

    setIsReplying(true);
    setError(undefined);

    try {
      const response = await fetch(
        `${apiBaseUrl}/conversations/${conversationDetail.id}/agent-replies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": tenantSlug
          },
          body: JSON.stringify({
            userId: selectedUserId,
            message: replyDraft.trim()
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Agent reply failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ConversationDetail;
      setConversationDetail(payload);
      setReplyDraft("");
      await loadConversations(filter);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send agent reply.");
    } finally {
      setIsReplying(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div>
        <strong>Conversation management</strong>
        <div style={{ color: "#6e5f53", fontSize: "0.95rem", marginTop: 6 }}>
          Claim pending conversations, inspect the full trail, and send a human reply.
        </div>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.92rem", color: "#6e5f53" }}>Conversation filter</span>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid rgba(62, 44, 31, 0.12)"
          }}
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>Conversations</strong>
        {isLoading ? <div style={{ color: "#6e5f53" }}>Loading conversations...</div> : null}
        {!isLoading && conversations.length === 0 ? (
          <div style={{ color: "#6e5f53" }}>No conversations for the current filter.</div>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelectedConversationId(conversation.id)}
              style={{
                textAlign: "left",
                borderRadius: "14px",
                border:
                  selectedConversationId === conversation.id
                    ? "1px solid #231a14"
                    : "1px solid rgba(62, 44, 31, 0.12)",
                background: "#fffaf6",
                padding: "10px 12px",
                cursor: "pointer"
              }}
            >
              <strong>{conversation.id.slice(-8)}</strong>
              <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>
                status: {conversation.status} | customer:{" "}
                {conversation.customer.name || conversation.customer.email || conversation.customer.visitorId || "anonymous"}
              </div>
              <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>
                assigned: {conversation.assignedUser?.name || conversation.assignedUser?.email || "unassigned"}
              </div>
              <div style={{ fontSize: "0.9rem", color: "#6e5f53" }}>
                last message: {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : "none"}
              </div>
              {conversation.isHandoffPending ? (
                <div style={{ fontSize: "0.9rem", color: "#b42318" }}>handoff pending</div>
              ) : null}
            </button>
          ))
        )}
      </div>

      {conversationDetail ? (
        <div style={{ display: "grid", gap: 10 }}>
          <strong>Conversation detail</strong>
          <div style={{ border: "1px solid rgba(62, 44, 31, 0.12)", borderRadius: 14, padding: 12 }}>
            <div>Conversation ID: {conversationDetail.id}</div>
            <div>Status: {conversationDetail.status}</div>
            <div>
              Customer:{" "}
              {conversationDetail.customer.name ||
                conversationDetail.customer.email ||
                conversationDetail.customer.visitorId ||
                conversationDetail.customer.id}
            </div>
            <div>
              Assigned:{" "}
              {conversationDetail.assignedUser?.name ||
                conversationDetail.assignedUser?.email ||
                "unassigned"}
            </div>
            {conversationDetail.handoffRequestedAt ? (
              <div>Handoff requested: {new Date(conversationDetail.handoffRequestedAt).toLocaleString()}</div>
            ) : null}
            {conversationDetail.handoffReason ? (
              <div>Handoff reason: {conversationDetail.handoffReason}</div>
            ) : null}
          </div>

          <form onSubmit={handleAssign} style={{ display: "grid", gap: 8 }}>
            <strong>Assignment</strong>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: "12px",
                border: "1px solid rgba(62, 44, 31, 0.12)"
              }}
            >
              {supportUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email} {user.roleName ? `(${user.roleName})` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isAssigning || !selectedUserId}
              style={{
                alignSelf: "start",
                border: 0,
                borderRadius: "999px",
                padding: "10px 14px",
                background: "#231a14",
                color: "#fffaf6",
                cursor: "pointer"
              }}
            >
              {isAssigning
                ? "Assigning..."
                : `Assign to ${selectedUser?.name || selectedUser?.email || "support user"}`}
            </button>
          </form>

          <form onSubmit={handleAgentReply} style={{ display: "grid", gap: 8 }}>
            <strong>Human reply</strong>
            <textarea
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              placeholder="Send a manual support reply"
              style={{
                minHeight: "120px",
                borderRadius: "14px",
                border: "1px solid rgba(62, 44, 31, 0.12)",
                padding: "12px",
                font: "inherit"
              }}
            />
            <button
              type="submit"
              disabled={isReplying || !selectedUserId || !replyDraft.trim()}
              style={{
                alignSelf: "start",
                border: 0,
                borderRadius: "999px",
                padding: "10px 14px",
                background: "#231a14",
                color: "#fffaf6",
                cursor: "pointer"
              }}
            >
              {isReplying ? "Sending..." : "Send human reply"}
            </button>
          </form>

          <div style={{ display: "grid", gap: 8 }}>
            <strong>Messages</strong>
            {conversationDetail.messages.map((message) => (
              <div
                key={message.id}
                style={{
                  borderRadius: "14px",
                  border: "1px solid rgba(62, 44, 31, 0.12)",
                  background: message.authorType === "customer" ? "#f6efe7" : "#fffaf6",
                  padding: "10px 12px"
                }}
              >
                <strong>
                  {message.authorType === "agent" && message.authorName
                    ? `${authorLabels[message.authorType]} · ${message.authorName}`
                    : authorLabels[message.authorType]}
                </strong>
                <div style={{ fontSize: "0.9rem", color: "#6e5f53", marginTop: 4 }}>
                  {new Date(message.createdAt).toLocaleString()} | type: {message.messageType}
                </div>
                <div style={{ marginTop: 8 }}>{message.content}</div>
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
        </div>
      ) : null}

      {error ? <div style={{ color: "#b42318" }}>{error}</div> : null}
    </section>
  );
}
