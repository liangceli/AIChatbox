import type { CSSProperties } from "react";

export const defaultAdminPrimaryColor = "#fec931";
export const adminColorSchemeStorageKey = "admin-color-scheme";
export type AdminColorScheme = "light" | "dark";

export function normalizeAdminPrimaryColor(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";

  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : defaultAdminPrimaryColor;
}

export function applyAdminColorScheme(colorScheme: AdminColorScheme) {
  document.documentElement.dataset.theme = colorScheme;
  document.documentElement.style.colorScheme = colorScheme;
  window.localStorage.setItem(adminColorSchemeStorageKey, colorScheme);
}

export function buildAdminThemeStyle(value: string): CSSProperties {
  const primaryContainer = normalizeAdminPrimaryColor(value);
  const primary = getReadableAccentColor(primaryContainer);
  const primaryStrong = mixHexColor(
    primaryContainer,
    "#000000",
    getRelativeLuminance(primaryContainer) > 0.55 ? 0.5 : 0.18
  );

  return {
    "--primary": primary,
    "--primary-container": primaryContainer,
    "--on-primary-container": getReadableTextColor(primaryContainer),
    "--primary-strong": primaryStrong,
    "--on-primary-strong": getReadableTextColor(primaryStrong),
    "--primary-soft": hexToRgba(primaryContainer, 0.08),
    "--primary-soft-hover": hexToRgba(primaryContainer, 0.16),
    "--primary-focus": hexToRgba(primaryContainer, 0.24),
    "--primary-border": hexToRgba(primaryContainer, 0.32),
    "--primary-shadow": hexToRgba(primaryContainer, 0.3)
  } as CSSProperties;
}

function getReadableAccentColor(hexColor: string): string {
  return getRelativeLuminance(hexColor) > 0.64 ? mixHexColor(hexColor, "#000000", 0.58) : hexColor;
}

function getReadableTextColor(hexColor: string): string {
  return getRelativeLuminance(hexColor) > 0.56 ? "#171821" : "#ffffff";
}

function getRelativeLuminance(hexColor: string): number {
  const [red, green, blue] = parseHexColor(hexColor);
  const toLinearChannel = (channel: number) => {
    const scaled = channel / 255;

    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinearChannel(red) + 0.7152 * toLinearChannel(green) + 0.0722 * toLinearChannel(blue);
}

function hexToRgba(hexColor: string, alpha: number): string {
  const [red, green, blue] = parseHexColor(hexColor);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function mixHexColor(sourceHex: string, targetHex: string, targetWeight: number): string {
  const source = parseHexColor(sourceHex);
  const target = parseHexColor(targetHex);
  const boundedWeight = Math.min(Math.max(targetWeight, 0), 1);
  const mixed = source.map((channel, index) =>
    Math.round(channel * (1 - boundedWeight) + target[index]! * boundedWeight)
  );

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function parseHexColor(hexColor: string): [number, number, number] {
  const normalized = normalizeAdminPrimaryColor(hexColor).slice(1);

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16)
  ];
}
