export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type ConversationChannel = "widget" | "email" | "phone" | "admin";
export type MessageAuthorType = "customer" | "assistant" | "agent" | "system";

export interface TenantBranding {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  supportEmail?: string;
}

export interface Citation {
  documentId: string;
  title: string;
  url?: string;
  excerpt?: string;
}

export interface WidgetTheme {
  title?: string;
  headerBackground?: string;
}

export interface WidgetBootstrapOptions {
  tenantSlug: string;
  apiBaseUrl: string;
  theme?: WidgetTheme;
}
