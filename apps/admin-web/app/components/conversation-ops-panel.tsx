"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessageRecord,
  ConversationDetail,
  ConversationListItem,
  SupportUserRecord,
  UpdateHumanSupportRequest
} from "@platform/types";

const customerAvatarUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBzSSY0zSYuUn1Ewe4A3NsvnnAkGMjly-MmtW4ThTM2Ekakbp-pzRIfGVIzGfKRX2j8-pid2ECZDbc7L-LGWPLdg5GqNomoDO1sqfeQlf_L7QYS8qDvrSlDei7uRo3ghjgJfXwYKqhqR8S43GXQCkeSaZumW6dAEMmLpvSpWj9hCyk2CJEvNevc1t6okXRGx18ZNEOOlAI191-E0zY-77k_vAqg7xg_kvH4HmYLL8mj4Hc5GE7iKx9TGxT5xC9c-OlA7JTsh0zlWLo2";

export function ConversationOpsPanel({
  apiBaseUrl,
  tenantSlug,
  allowAssignment = true
}: {
  apiBaseUrl: string;
  tenantSlug: string;
  allowAssignment?: boolean;
  allowAdminDeletes?: boolean;
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
  const [isReplying, setIsReplying] = useState(false);
  const [isUpdatingHumanSupport, setIsUpdatingHumanSupport] = useState(false);
  const conversationsSignatureRef = useRef("");
  const detailSignatureRef = useRef("");

  useEffect(() => {
    void loadSupportUsers();
  }, [tenantSlug]);

  useEffect(() => {
    void loadConversations(filter);
  }, [filter, tenantSlug]);

  useEffect(() => {
    const events = new EventSource(
      `${apiBaseUrl}/realtime/conversations?tenantSlug=${encodeURIComponent(tenantSlug)}&status=${encodeURIComponent(filter)}`
    );

    events.addEventListener("conversation_snapshot", (event) => {
      const payload = JSON.parse(event.data) as {
        conversations?: ConversationListItem[];
        activeConversation?: ConversationDetail | null;
      };
      const nextConversations = payload.conversations ?? [];
      const nextSignature = createConversationsSignature(nextConversations);

      if (nextSignature !== conversationsSignatureRef.current) {
        conversationsSignatureRef.current = nextSignature;
        setConversations(nextConversations);
        setSelectedConversationId((current) =>
          current && nextConversations.some((conversation) => conversation.id === current)
            ? current
            : nextConversations[0]?.id
        );
      }

      if (selectedConversationId && payload.activeConversation?.id === selectedConversationId) {
        const nextDetailSignature = createDetailSignature(payload.activeConversation);

        if (nextDetailSignature !== detailSignatureRef.current) {
          detailSignatureRef.current = nextDetailSignature;
          setConversationDetail(payload.activeConversation);
        }
      }
    });

    events.onerror = () => {
      events.close();
    };

    return () => {
      events.close();
    };
  }, [apiBaseUrl, tenantSlug, filter, selectedConversationId]);

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
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );
  const chronologicalMessages = useMemo(() => {
    const messages = conversationDetail?.messages ?? [];

    return [...messages].sort(
      (firstMessage, secondMessage) =>
        new Date(firstMessage.createdAt).getTime() - new Date(secondMessage.createdAt).getTime()
    );
  }, [conversationDetail?.messages]);
  const latestMessage = chronologicalMessages.at(-1)?.content ?? "";
  const isHumanModeActive = conversationDetail?.status === "pending_human";

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
      conversationsSignatureRef.current = createConversationsSignature(payload);
      setConversations(payload);
      setSelectedConversationId((current) =>
        current && payload.some((conversation) => conversation.id === current)
          ? current
          : payload[0]?.id
      );
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load conversations.");
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
      detailSignatureRef.current = createDetailSignature(payload);
      setConversationDetail(payload);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load conversation detail.");
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
      const response = await fetch(`${apiBaseUrl}/conversations/${conversationDetail.id}/agent-replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": tenantSlug
        },
        body: JSON.stringify({
          userId: selectedUserId,
          message: replyDraft.trim()
        })
      });

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

  async function updateHumanSupportMode(nextEnabled: boolean) {
    if (!conversationDetail?.id || isUpdatingHumanSupport) {
      return;
    }

    setIsUpdatingHumanSupport(true);
    setError(undefined);

    try {
      const body: UpdateHumanSupportRequest = {
        ...(selectedUserId ? { userId: selectedUserId } : {}),
        reason: nextEnabled
          ? "Agent enabled human support from the console."
          : "Agent ended human support from the console."
      };
      const response = await fetch(
        `${apiBaseUrl}/conversations/${conversationDetail.id}/human-support/${nextEnabled ? "start" : "end"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant-slug": tenantSlug
          },
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        throw new Error(
          `Human support ${nextEnabled ? "start" : "end"} failed with status ${response.status}`
        );
      }

      const payload = (await response.json()) as ConversationDetail;
      detailSignatureRef.current = createDetailSignature(payload);
      setConversationDetail(payload);
      await loadConversations(filter);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update human support mode."
      );
    } finally {
      setIsUpdatingHumanSupport(false);
    }
  }

  return (
    <section className="conversation-grid">
      <div className="chat-list-panel">
        <div className="chat-list-header">
          <div className="live-heading">
            <h3>Active Chats</h3>
            <span>LIVE</span>
          </div>
          <div className="chat-filter-buttons" aria-label="Conversation filters">
            <button
              type="button"
              className={filter === "all" ? "active" : undefined}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={filter === "pending_human" ? "active" : undefined}
              onClick={() => setFilter("pending_human")}
            >
              Alerts
            </button>
          </div>
        </div>

        <div className="chat-list">
          {isLoading ? <div className="chat-empty-state">Loading conversations...</div> : null}
          {!isLoading && conversations.length === 0 ? (
            <div className="chat-empty-state">No conversations for the current filter.</div>
          ) : (
            conversations.map((conversation, index) => {
              const customerName = getCustomerName(conversation);
              const isSelected = selectedConversationId === conversation.id;
              const status = getConversationDisplayStatus(conversation);

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`chat-list-item ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  {index === 0 ? (
                    <img alt="" className="chat-avatar image" src={customerAvatarUrl} />
                  ) : (
                    <span className="chat-avatar initials">{getInitials(customerName)}</span>
                  )}
                  <span className="chat-item-copy">
                    <span className="chat-item-title">
                      <strong>{customerName}</strong>
                      <small>{formatRelativeTime(conversation.lastMessageAt)}</small>
                    </span>
                    <span className="chat-preview">
                      {isSelected && latestMessage ? latestMessage : `Conversation status: ${conversation.status}`}
                    </span>
                    <span className={`chat-status ${status.tone}`}>
                      <Icon name={status.icon} />
                      {status.label}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <aside className="conversation-detail-column">
        <div className="metadata-card glass-card">
          <div className="metadata-heading">
            <h3>Metadata</h3>
            <Icon name="info" />
          </div>
          <div className="metadata-list">
            <div>
              <span>Session</span>
              <strong>{conversationDetail?.id.slice(-11).toUpperCase() ?? "8841-KK-902"}</strong>
            </div>
            <div>
              <span>Language</span>
              <strong>English</strong>
            </div>
            <div>
              <span>Status</span>
              <strong className={conversationDetail?.status === "pending_human" ? "error" : ""}>
                <i />
                {conversationDetail?.status === "pending_human" ? "Wait" : conversationDetail?.status ?? "Wait"}
              </strong>
            </div>
            {allowAssignment && selectedUser ? (
              <div>
                <span>Agent</span>
                <strong>{selectedUser.name || selectedUser.email}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <div className="handoff-control-card glass-card">
          <div className="handoff-control-heading">
            <div>
              <h3>Human Mode</h3>
              <p>
                {isHumanModeActive
                  ? "AI is paused for this conversation until a customer or agent ends human support."
                  : "AI can reply to customer messages unless human support is enabled."}
              </p>
            </div>
            <Icon name={isHumanModeActive ? "support_agent" : "smart_toy"} />
          </div>
          <button
            type="button"
            className={isHumanModeActive ? "handoff-toggle active" : "handoff-toggle"}
            disabled={!conversationDetail || isUpdatingHumanSupport}
            onClick={() => updateHumanSupportMode(!isHumanModeActive)}
          >
            <Icon name={isHumanModeActive ? "toggle_off" : "toggle_on"} />
            <span>
              {isUpdatingHumanSupport
                ? "Updating..."
                : isHumanModeActive
                  ? "End human support"
                  : "Start human support"}
            </span>
          </button>
        </div>

        <form className="human-reply-card" onSubmit={handleAgentReply}>
          <h3>
            <Icon name="record_voice_over" />
            Human Reply
          </h3>
          <p>
            Full customer, AI, agent, and system history is shown here for the selected conversation.
          </p>
          <div className="human-reply-history" aria-live="polite">
            <div className="human-reply-history-heading">
              <strong>Conversation History</strong>
              <span>
                {conversationDetail
                  ? `${chronologicalMessages.length} messages`
                  : "No conversation selected"}
              </span>
            </div>
            <div className="conversation-history-list">
              {!conversationDetail ? (
                <div className="conversation-history-empty">
                  Select a conversation to view its complete message history.
                </div>
              ) : chronologicalMessages.length === 0 ? (
                <div className="conversation-history-empty">
                  No messages have been recorded for this conversation.
                </div>
              ) : (
                chronologicalMessages.map((message) => (
                  <MessageHistoryItem key={message.id} message={message} />
                ))
              )}
            </div>
          </div>
          <textarea
            value={replyDraft}
            onChange={(event) => setReplyDraft(event.target.value)}
            placeholder={conversationDetail ? "Type response..." : "Select a conversation first"}
            disabled={!conversationDetail}
          />
          <button
            type="submit"
            className="primary-btn"
            disabled={isReplying || !conversationDetail || !selectedUserId || !replyDraft.trim()}
          >
            <Icon name="send" />
            <span>{isReplying ? "Sending..." : "Send Reply"}</span>
          </button>
        </form>

        {error ? <div className="panel-error">{error}</div> : null}
      </aside>
    </section>
  );
}

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined">{name}</span>;
}

function MessageHistoryItem({ message }: { message: ChatMessageRecord }) {
  const role = getMessageRole(message);

  return (
    <article className={`history-message ${message.authorType}`}>
      <div className="history-message-meta">
        <span className={`history-role-pill ${message.authorType}`}>{role.label}</span>
        <time dateTime={message.createdAt}>{formatTimestamp(message.createdAt)}</time>
      </div>
      <div className="history-message-content">{message.content}</div>
      {message.authorName ? <div className="history-author">By {message.authorName}</div> : null}
      {message.messageType !== "text" ? (
        <div className="history-message-type">{formatMessageType(message.messageType)}</div>
      ) : null}
      {message.citations?.length ? (
        <div className="history-citations">
          <strong>Sources</strong>
          {message.citations.map((citation) => (
            <div key={`${message.id}-${citation.chunkId}-${citation.chunkIndex}`} className="history-citation">
              <span>{citation.title}</span>
              <small>
                chunk {citation.chunkIndex}
                {citation.sourceUri ? ` - ${citation.sourceUri}` : ""}
              </small>
              {citation.excerpt ? <em>{citation.excerpt}</em> : null}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function getMessageRole(message: ChatMessageRecord) {
  switch (message.authorType) {
    case "customer":
      return { label: "Customer" };
    case "assistant":
      return { label: "Assistant" };
    case "agent":
      return { label: "Agent" };
    case "system":
      return { label: message.messageType === "handoff_event" ? "Handoff" : "System" };
    default:
      return { label: "Message" };
  }
}

function getCustomerName(conversation: ConversationListItem): string {
  return (
    conversation.customer.name ||
    conversation.customer.email ||
    conversation.customer.visitorId ||
    "Anonymous visitor"
  );
}

function getInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "AV";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatRelativeTime(value?: string | null): string {
  if (!value) {
    return "now";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  return `${Math.round(diffMinutes / 60)}h`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMessageType(value: string): string {
  return value.replace(/_/g, " ");
}

function getConversationDisplayStatus(conversation: ConversationListItem) {
  if (conversation.isHandoffPending || conversation.status === "pending_human") {
    return {
      label: "Escalate",
      icon: "priority_high",
      tone: "error"
    };
  }

  if (conversation.status === "resolved" || conversation.status === "closed") {
    return {
      label: "Resolved",
      icon: "check_circle",
      tone: "success"
    };
  }

  return {
    label: "Open",
    icon: "radio_button_checked",
    tone: "primary"
  };
}

function createConversationsSignature(conversations: ConversationListItem[]): string {
  return conversations
    .map(
      (conversation) =>
        `${conversation.id}:${conversation.status}:${conversation.assignedUser?.id ?? ""}:${conversation.lastMessageAt ?? ""}`
    )
    .join("|");
}

function createDetailSignature(conversation: ConversationDetail): string {
  return `${conversation.id}:${conversation.status}:${conversation.assignedUser?.id ?? ""}:${conversation.lastMessageAt ?? ""}:${conversation.messages.length}:${conversation.messages.at(-1)?.id ?? ""}`;
}
