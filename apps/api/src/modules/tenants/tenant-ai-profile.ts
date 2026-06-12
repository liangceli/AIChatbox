import type {
  PublicTenantAiProfile,
  TenantAiProfile,
  UpdateTenantAiProfileRequest
} from "@platform/types";

type JsonRecord = Record<string, unknown>;

type TenantProfileTenant = {
  name: string;
  branding?: unknown;
};

type TenantProfileAgentConfig = {
  displayName?: string | null;
  systemPrompt?: string | null;
  welcomeMessage?: string | null;
  fallbackMessage?: string | null;
  metadata?: unknown;
  widgetSettings?: unknown;
} | null;

export const DEFAULT_TENANT_AI_PROFILE = {
  assistantName: "AI Support Assistant",
  companyDisplayName: "Demo Company",
  businessType: "customer support",
  tone: "helpful, concise, professional",
  welcomeMessage: "Hi, how can I help today?",
  fallbackMessage:
    "I do not have enough confirmed information to answer that. I can connect you with the team for help.",
  handoffMessage: "I can pass this to a team member for support.",
  safeAnswerInstructions:
    "Use confirmed support knowledge and safe general guidance. If information is missing, say that clearly.",
  sensitiveTopicInstructions:
    "For sensitive or uncertain topics, avoid guessing and recommend human support when appropriate.",
  doNotAnswerInstructions:
    "Do not answer with unsupported prices, policies, guarantees, private data, credentials, or internal system details."
} as const;

export function buildTenantAiProfile(
  tenant: TenantProfileTenant,
  agentConfig?: TenantProfileAgentConfig
): TenantAiProfile {
  const branding = toRecord(tenant.branding);
  const metadata = toRecord(agentConfig?.metadata);
  const widgetSettings = toRecord(agentConfig?.widgetSettings);
  const profileMetadata = toRecord(metadata.aiProfile);

  return {
    assistantName:
      readString(agentConfig?.displayName) ??
      readString(profileMetadata.assistantName) ??
      DEFAULT_TENANT_AI_PROFILE.assistantName,
    companyDisplayName:
      readString(profileMetadata.companyDisplayName) ??
      readString(widgetSettings.companyDisplayName) ??
      readString(branding.name) ??
      tenant.name ??
      DEFAULT_TENANT_AI_PROFILE.companyDisplayName,
    businessType:
      readString(profileMetadata.businessType) ?? DEFAULT_TENANT_AI_PROFILE.businessType,
    tone: readString(profileMetadata.tone) ?? DEFAULT_TENANT_AI_PROFILE.tone,
    welcomeMessage:
      readString(agentConfig?.welcomeMessage) ??
      readString(widgetSettings.welcomeMessage) ??
      DEFAULT_TENANT_AI_PROFILE.welcomeMessage,
    fallbackMessage:
      readString(agentConfig?.fallbackMessage) ??
      readString(widgetSettings.fallbackMessage) ??
      DEFAULT_TENANT_AI_PROFILE.fallbackMessage,
    handoffMessage:
      readString(profileMetadata.handoffMessage) ??
      readString(widgetSettings.handoffMessage) ??
      DEFAULT_TENANT_AI_PROFILE.handoffMessage,
    safeAnswerInstructions:
      readString(profileMetadata.safeAnswerInstructions) ??
      readString(agentConfig?.systemPrompt) ??
      DEFAULT_TENANT_AI_PROFILE.safeAnswerInstructions,
    sensitiveTopicInstructions:
      readString(profileMetadata.sensitiveTopicInstructions) ??
      DEFAULT_TENANT_AI_PROFILE.sensitiveTopicInstructions,
    doNotAnswerInstructions:
      readString(profileMetadata.doNotAnswerInstructions) ??
      DEFAULT_TENANT_AI_PROFILE.doNotAnswerInstructions,
    primaryColor:
      readNullableString(profileMetadata.primaryColor) ??
      readNullableString(widgetSettings.primaryColor) ??
      readNullableString(branding.primaryColor),
    logoUrl: firstDefined(
      readNullableString(profileMetadata.logoUrl),
      readNullableString(widgetSettings.logoUrl),
      readNullableString(branding.logoUrl)
    ),
    avatarUrl: firstDefined(
      readNullableString(profileMetadata.avatarUrl),
      readNullableString(widgetSettings.avatarUrl)
    )
  };
}

export function mergeTenantAiProfile(
  current: TenantAiProfile,
  input: UpdateTenantAiProfileRequest
): TenantAiProfile {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    )
  };
}

export function toPublicTenantAiProfile(profile: TenantAiProfile): PublicTenantAiProfile {
  return {
    assistantName: profile.assistantName,
    companyDisplayName: profile.companyDisplayName,
    welcomeMessage: profile.welcomeMessage,
    fallbackMessage: profile.fallbackMessage,
    handoffMessage: profile.handoffMessage,
    primaryColor: profile.primaryColor ?? null,
    logoUrl: profile.logoUrl ?? null,
    avatarUrl: profile.avatarUrl ?? null
  };
}

export function buildAgentConfigPersistence(
  profile: TenantAiProfile,
  existing?: TenantProfileAgentConfig
) {
  const metadata = toRecord(existing?.metadata);
  const widgetSettings = toRecord(existing?.widgetSettings);

  return {
    displayName: profile.assistantName,
    welcomeMessage: profile.welcomeMessage,
    fallbackMessage: profile.fallbackMessage,
    widgetSettings: {
      ...widgetSettings,
      title: profile.assistantName,
      companyDisplayName: profile.companyDisplayName,
      welcomeMessage: profile.welcomeMessage,
      fallbackMessage: profile.fallbackMessage,
      handoffMessage: profile.handoffMessage,
      primaryColor: profile.primaryColor ?? null,
      logoUrl: profile.logoUrl ?? null,
      avatarUrl: profile.avatarUrl ?? null
    },
    metadata: {
      ...metadata,
      aiProfile: {
        assistantName: profile.assistantName,
        companyDisplayName: profile.companyDisplayName,
        businessType: profile.businessType,
        tone: profile.tone,
        handoffMessage: profile.handoffMessage,
        safeAnswerInstructions: profile.safeAnswerInstructions,
        sensitiveTopicInstructions: profile.sensitiveTopicInstructions,
        doNotAnswerInstructions: profile.doNotAnswerInstructions,
        primaryColor: profile.primaryColor ?? null,
        logoUrl: profile.logoUrl ?? null,
        avatarUrl: profile.avatarUrl ?? null
      }
    }
  };
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return readString(value);
}

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined);
}
