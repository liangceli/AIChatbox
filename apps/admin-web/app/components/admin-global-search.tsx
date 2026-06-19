"use client";

import type { AdminSearchResponse, AdminSearchResult } from "@platform/types";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type SearchEntry = AdminSearchResult & {
  group: "Navigation" | "Conversations" | "Knowledge";
  href: string;
  icon: string;
};

const navigationEntries: SearchEntry[] = [
  {
    id: "navigation:dashboard",
    kind: "knowledge_base",
    group: "Navigation",
    title: "Dashboard",
    subtitle: "Tenant overview and AI Profile",
    href: "/admin",
    icon: "dashboard"
  },
  {
    id: "navigation:knowledge",
    kind: "knowledge_base",
    group: "Navigation",
    title: "Knowledge Base",
    subtitle: "Documents, chunks, ingestion, and Answer Debug",
    href: "/admin/knowledge-base",
    icon: "database"
  },
  {
    id: "navigation:conversations",
    kind: "conversation",
    group: "Navigation",
    title: "Conversations",
    subtitle: "All customer conversations",
    href: "/admin/conversations?status=all",
    icon: "chat"
  },
  {
    id: "navigation:pending-human",
    kind: "conversation",
    group: "Navigation",
    title: "Pending Human",
    subtitle: "Conversations waiting for support",
    href: "/admin/conversations?status=pending_human",
    icon: "person_alert"
  },
  {
    id: "navigation:ai-profile",
    kind: "knowledge_base",
    group: "Navigation",
    title: "AI Profile",
    subtitle: "Assistant identity, tone, branding, and safety",
    href: "/admin#ai-profile",
    icon: "tune"
  }
];

export function AdminGlobalSearch({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<AdminSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedQuery = query.trim().toLowerCase();
  const navigationResults = useMemo(() => {
    if (!normalizedQuery) {
      return navigationEntries;
    }

    return navigationEntries.filter((entry) =>
      `${entry.title} ${entry.subtitle}`.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);
  const resourceResults = useMemo(
    () => remoteResults.map(toSearchEntry),
    [remoteResults]
  );
  const results = useMemo(
    () => [...navigationResults, ...resourceResults],
    [navigationResults, resourceResults]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, remoteResults]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setRemoteResults([]);
      setIsLoading(false);
      setError(undefined);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError(undefined);

      try {
        const response = await fetch(
          `${apiBaseUrl}/search?q=${encodeURIComponent(query.trim())}&limit=6`,
          {
            headers: { "x-tenant-slug": tenantSlug },
            signal: controller.signal
          }
        );

        if (!response.ok) {
          throw new Error(`Search request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as AdminSearchResponse;
        setRemoteResults(payload.results);
      } catch (requestError: unknown) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return;
        }

        setRemoteResults([]);
        setError("Search is temporarily unavailable.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [apiBaseUrl, normalizedQuery, query, tenantSlug]);

  function openEntry(entry: SearchEntry) {
    setIsOpen(false);
    setQuery("");
    router.push(entry.href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (results.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
      return;
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      openEntry(results[activeIndex] ?? results[0]!);
    }
  }

  return (
    <div className="topbar-search admin-global-search" ref={rootRef}>
      <div className="admin-search-input-shell">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search tenant resources"
          aria-expanded={isOpen}
          aria-controls="admin-global-search-results"
          aria-activedescendant={isOpen && results[activeIndex] ? `search-result-${activeIndex}` : undefined}
          placeholder="Search resources..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {isLoading ? <Icon name="progress_activity" className="search-loading-icon" /> : null}
        {query ? (
          <button
            type="button"
            className="search-clear-button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setRemoteResults([]);
            }}
          >
            <Icon name="close" />
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="admin-search-results" id="admin-global-search-results" role="listbox">
          {error ? <div className="admin-search-state error">{error}</div> : null}
          {!error && results.length === 0 && !isLoading ? (
            <div className="admin-search-state">No matching resources.</div>
          ) : null}
          {!error ? renderGroupedResults(results, activeIndex, setActiveIndex, openEntry) : null}
        </div>
      ) : null}
    </div>
  );
}

function renderGroupedResults(
  results: SearchEntry[],
  activeIndex: number,
  setActiveIndex: (index: number) => void,
  openEntry: (entry: SearchEntry) => void
) {
  const groups = ["Navigation", "Conversations", "Knowledge"] as const;

  return groups.map((group) => {
    const groupEntries = results
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.group === group);

    if (groupEntries.length === 0) {
      return null;
    }

    return (
      <section className="admin-search-group" key={group} aria-label={group}>
        <h2>{group}</h2>
        {groupEntries.map(({ entry, index }) => (
          <button
            key={entry.id}
            id={`search-result-${index}`}
            type="button"
            role="option"
            aria-selected={activeIndex === index}
            className={activeIndex === index ? "active" : undefined}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => openEntry(entry)}
          >
            <span className="admin-search-result-icon"><Icon name={entry.icon} /></span>
            <span className="admin-search-result-copy">
              <strong>{entry.title}</strong>
              <small>{entry.subtitle}</small>
              {entry.description ? <span>{entry.description}</span> : null}
            </span>
            <Icon name="arrow_forward" className="admin-search-result-arrow" />
          </button>
        ))}
      </section>
    );
  });
}

function toSearchEntry(result: AdminSearchResult): SearchEntry {
  if (result.kind === "conversation") {
    return {
      ...result,
      group: "Conversations",
      href: `/admin/conversations?status=all&conversationId=${encodeURIComponent(result.conversationId ?? result.id)}`,
      icon: result.status === "pending_human" ? "person_alert" : "chat"
    };
  }

  const knowledgeBaseId = result.knowledgeBaseId ?? "";
  const documentQuery = result.documentId
    ? `&documentId=${encodeURIComponent(result.documentId)}`
    : "";

  return {
    ...result,
    group: "Knowledge",
    href: `/admin/knowledge-base?knowledgeBaseId=${encodeURIComponent(knowledgeBaseId)}${documentQuery}`,
    icon: result.kind === "knowledge_document" ? "description" : "database"
  };
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}
