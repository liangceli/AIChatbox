export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function coerceBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value === "true" || value === "1";
}

export function createAnonymousVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `visitor-${Date.now()}`;
}

export function getAnonymousVisitorStorageKey(tenantSlug: string): string {
  return `customer-widget:${tenantSlug}:visitor-id`;
}

export function readAnonymousVisitorId(tenantSlug: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(getAnonymousVisitorStorageKey(tenantSlug));
}

export function persistAnonymousVisitorId(tenantSlug: string, visitorId: string): string {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(getAnonymousVisitorStorageKey(tenantSlug), visitorId);
  }

  return visitorId;
}

export function resolveAnonymousVisitorId(tenantSlug: string, providedVisitorId?: string): string | null {
  if (providedVisitorId?.trim()) {
    return persistAnonymousVisitorId(tenantSlug, providedVisitorId.trim());
  }

  const existingVisitorId = readAnonymousVisitorId(tenantSlug);

  if (existingVisitorId?.trim()) {
    return existingVisitorId;
  }

  return persistAnonymousVisitorId(tenantSlug, createAnonymousVisitorId());
}
