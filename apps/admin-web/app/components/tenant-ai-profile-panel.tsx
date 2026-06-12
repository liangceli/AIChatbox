"use client";

import { ChangeEvent, CSSProperties, FormEvent, useEffect, useState } from "react";
import type { TenantAiProfile, UpdateTenantAiProfileRequest } from "@platform/types";

const maxProfileImageBytes = 1_000_000;
const acceptedProfileImageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const profileColorPresets = [
  "#1d4ed8",
  "#0f766e",
  "#15803d",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#7c3aed",
  "#18181b"
];

const fallbackProfile: TenantAiProfile = {
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
    "Do not answer with unsupported prices, policies, guarantees, private data, credentials, or internal system details.",
  primaryColor: "",
  logoUrl: "",
  avatarUrl: ""
};

export function TenantAiProfilePanel({
  apiBaseUrl,
  tenantSlug
}: {
  apiBaseUrl: string;
  tenantSlug: string;
}) {
  const [profile, setProfile] = useState<TenantAiProfile>(fallbackProfile);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void loadProfile();
  }, [apiBaseUrl, tenantSlug]);

  async function loadProfile() {
    setIsLoading(true);
    setError(undefined);
    setStatusMessage(undefined);

    try {
      const response = await fetch(`${apiBaseUrl}/tenants/${encodeURIComponent(tenantSlug)}/ai-profile`);

      if (!response.ok) {
        throw new Error(`AI profile request failed with status ${response.status}`);
      }

      setProfile(normalizeProfileForForm((await response.json()) as TenantAiProfile));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load AI profile.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    setStatusMessage(undefined);

    try {
      const payload = buildUpdatePayload(profile);
      const response = await fetch(`${apiBaseUrl}/tenants/${encodeURIComponent(tenantSlug)}/ai-profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`AI profile save failed with status ${response.status}`);
      }

      setProfile(normalizeProfileForForm((await response.json()) as TenantAiProfile));
      setStatusMessage("AI profile saved.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save AI profile.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateField<K extends keyof TenantAiProfile>(field: K, value: TenantAiProfile[K]) {
    setProfile((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleImageUpload(
    field: "logoUrl" | "avatarUrl",
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError(undefined);
    setStatusMessage(undefined);

    if (!acceptedProfileImageTypes.includes(file.type)) {
      setError("Upload a PNG, JPEG, WebP, or GIF image.");
      return;
    }

    if (file.size > maxProfileImageBytes) {
      setError("Uploaded images must be 1 MB or smaller.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Unable to read the selected image.");
        return;
      }

      updateField(field, reader.result);
      setStatusMessage(`${field === "logoUrl" ? "Logo" : "Avatar"} ready to save.`);
    };
    reader.onerror = () => setError("Unable to read the selected image.");
    reader.readAsDataURL(file);
  }

  return (
    <section className="profile-panel glass-card" aria-label="Tenant AI profile">
      <div className="section-heading-row profile-heading">
        <div>
          <h3>AI Profile</h3>
          <p>Customize the tenant assistant identity, tone, safety boundaries, and widget basics.</p>
        </div>
        <button
          type="button"
          className="initialize-button primary-btn"
          onClick={() => void loadProfile()}
          disabled={isLoading || isSaving}
        >
          <Icon name="refresh" />
          <span>{isLoading ? "Loading..." : "Reload"}</span>
        </button>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-form-grid">
          <ProfileInput
            label="Assistant name"
            value={profile.assistantName}
            onChange={(value) => updateField("assistantName", value)}
          />
          <ProfileInput
            label="Company display name"
            value={profile.companyDisplayName}
            onChange={(value) => updateField("companyDisplayName", value)}
          />
          <ProfileInput
            label="Business type"
            value={profile.businessType}
            onChange={(value) => updateField("businessType", value)}
          />
          <ProfileInput
            label="Tone"
            value={profile.tone}
            onChange={(value) => updateField("tone", value)}
          />
          <ProfileColorInput
            value={profile.primaryColor ?? ""}
            onChange={(value) => updateField("primaryColor", value)}
          />
          <ProfileImageInput
            label="Avatar"
            value={profile.avatarUrl ?? ""}
            onUpload={(event) => handleImageUpload("avatarUrl", event)}
            onUrlChange={(value) => updateField("avatarUrl", value)}
            onClear={() => updateField("avatarUrl", "")}
          />
          <ProfileImageInput
            label="Logo"
            value={profile.logoUrl ?? ""}
            onUpload={(event) => handleImageUpload("logoUrl", event)}
            onUrlChange={(value) => updateField("logoUrl", value)}
            onClear={() => updateField("logoUrl", "")}
          />
        </div>

        <ProfileTextArea
          label="Welcome message"
          value={profile.welcomeMessage}
          onChange={(value) => updateField("welcomeMessage", value)}
        />
        <ProfileTextArea
          label="Fallback message"
          value={profile.fallbackMessage}
          onChange={(value) => updateField("fallbackMessage", value)}
        />
        <ProfileTextArea
          label="Handoff message"
          value={profile.handoffMessage}
          onChange={(value) => updateField("handoffMessage", value)}
        />
        <ProfileTextArea
          label="Safe answer instructions"
          value={profile.safeAnswerInstructions}
          onChange={(value) => updateField("safeAnswerInstructions", value)}
        />
        <ProfileTextArea
          label="Sensitive topic instructions"
          value={profile.sensitiveTopicInstructions}
          onChange={(value) => updateField("sensitiveTopicInstructions", value)}
        />
        <ProfileTextArea
          label="Do-not-answer instructions"
          value={profile.doNotAnswerInstructions}
          onChange={(value) => updateField("doNotAnswerInstructions", value)}
        />

        <div className="profile-actions">
          <button className="ingest-submit primary-btn" type="submit" disabled={isLoading || isSaving}>
            {isSaving ? "Saving..." : "Save AI Profile"}
          </button>
          {statusMessage ? <span className="profile-status success">{statusMessage}</span> : null}
          {error ? <span className="profile-status error">{error}</span> : null}
        </div>
      </form>
    </section>
  );
}

function ProfileInput({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ProfileColorInput({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#1d4ed8";

  return (
    <div className="profile-color-field" role="group" aria-labelledby="profile-primary-color-label">
      <span id="profile-primary-color-label">Primary color</span>
      <span className="profile-color-control">
        <span className="profile-color-preview">
          <input
            aria-label="Choose custom primary color"
            className="profile-color-picker"
            type="color"
            value={pickerValue}
            onChange={(event) => onChange(event.target.value)}
          />
          <span>
            <strong>{pickerValue.toUpperCase()}</strong>
            <small>Choose a custom brand color</small>
          </span>
        </span>
        <span className="profile-color-presets" aria-label="Primary color presets">
          {profileColorPresets.map((color) => (
            <button
              key={color}
              type="button"
              className={pickerValue.toLowerCase() === color ? "selected" : undefined}
              style={{ "--profile-swatch": color } as CSSProperties}
              aria-label={`Use ${color}`}
              aria-pressed={pickerValue.toLowerCase() === color}
              onClick={() => onChange(color)}
            />
          ))}
        </span>
        <input
          aria-label="Primary color hex value"
          className="profile-color-value"
          value={value}
          placeholder="#1d4ed8"
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </div>
  );
}

function ProfileImageInput({
  label,
  value,
  onUpload,
  onUrlChange,
  onClear
}: {
  label: string;
  value: string;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onUrlChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="profile-image-field">
      <span className="profile-image-label">{label}</span>
      <div className="profile-image-upload">
        <div className="profile-image-preview">
          {value ? (
            <img src={value} alt={`${label} preview`} />
          ) : (
            <Icon name={label === "Logo" ? "image" : "account_circle"} />
          )}
        </div>
        <div className="profile-image-copy">
          <strong>Upload {label.toLowerCase()}</strong>
          <small>PNG, JPEG, WebP, or GIF. Maximum 1 MB.</small>
          <div className="profile-image-actions">
            <label className="profile-upload-button">
              <Icon name="upload" />
              <span>Choose image</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={onUpload}
              />
            </label>
            {value ? (
              <button type="button" className="profile-clear-image" onClick={onClear}>
                <Icon name="delete" />
                <span>Remove</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <label className="profile-url-fallback">
        <span>Or use image URL</span>
        <input
          aria-label={`${label} URL`}
          value={value.startsWith("data:image/") ? "" : value}
          placeholder={`https://example.com/${label.toLowerCase()}.png`}
          onChange={(event) => onUrlChange(event.target.value)}
        />
      </label>
    </div>
  );
}

function ProfileTextArea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function normalizeProfileForForm(profile: TenantAiProfile): TenantAiProfile {
  return {
    ...profile,
    primaryColor: profile.primaryColor ?? "",
    logoUrl: profile.logoUrl ?? "",
    avatarUrl: profile.avatarUrl ?? ""
  };
}

function buildUpdatePayload(profile: TenantAiProfile): UpdateTenantAiProfileRequest {
  return {
    ...profile,
    primaryColor: profile.primaryColor?.trim() || undefined,
    logoUrl: profile.logoUrl?.trim() || null,
    avatarUrl: profile.avatarUrl?.trim() || null
  };
}

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined">{name}</span>;
}
