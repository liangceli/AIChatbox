import { loadAdminWebEnv, loadWorkspaceEnv } from "@platform/config";
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_PREFIX = "v1";
let hasLoadedWorkspaceEnv = false;

export function loadAdminWebRuntimeEnv(cwd = process.cwd()): void {
  if (hasLoadedWorkspaceEnv) {
    return;
  }

  loadWorkspaceEnv(cwd);
  hasLoadedWorkspaceEnv = true;
}

export function getAdminWebConfig() {
  loadAdminWebRuntimeEnv();

  const env = loadAdminWebEnv(process.env);
  const accessToken = env.ADMIN_WEB_ACCESS_TOKEN?.trim();
  const sessionSecret = env.ADMIN_WEB_SESSION_SECRET?.trim();
  const adminApiToken = env.ADMIN_API_TOKEN?.trim();

  return {
    accessToken,
    sessionSecret,
    adminApiToken,
    apiInternalBaseUrl: env.API_INTERNAL_BASE_URL,
    cookieName: env.ADMIN_WEB_SESSION_COOKIE_NAME,
    sessionTtlSeconds: env.ADMIN_WEB_SESSION_TTL_SECONDS,
    secureCookie: env.NODE_ENV === "production"
  };
}

export function assertAdminWebAccessConfigured() {
  const config = getAdminWebConfig();

  if (!config.accessToken || !config.sessionSecret || !config.adminApiToken) {
    throw new Error("Admin web access is not configured.");
  }

  return {
    ...config,
    accessToken: config.accessToken,
    sessionSecret: config.sessionSecret,
    adminApiToken: config.adminApiToken
  };
}

export function createAdminSessionCookieValue(nowMs = Date.now()): string {
  const config = assertAdminWebAccessConfigured();
  const expiresAt = nowMs + config.sessionTtlSeconds * 1000;
  const signature = signSession(expiresAt, config.accessToken, config.sessionSecret);

  return `${SESSION_PREFIX}.${expiresAt}.${signature}`;
}

export function isValidAdminSessionCookie(value?: string, nowMs = Date.now()): boolean {
  if (!value?.trim()) {
    return false;
  }

  const config = getAdminWebConfig();

  if (!config.accessToken || !config.sessionSecret) {
    return false;
  }

  const [prefix, expiresAtText, signature] = value.split(".");
  const expiresAt = Number(expiresAtText);

  if (prefix !== SESSION_PREFIX || !Number.isSafeInteger(expiresAt) || expiresAt <= nowMs || !signature) {
    return false;
  }

  return timingSafeCompare(signature, signSession(expiresAt, config.accessToken, config.sessionSecret));
}

export function isValidAccessToken(providedToken: string): boolean {
  const config = assertAdminWebAccessConfigured();

  return timingSafeCompare(providedToken.trim(), config.accessToken);
}

function signSession(expiresAt: number, accessToken: string, sessionSecret: string): string {
  return createHmac("sha256", sessionSecret)
    .update(`${SESSION_PREFIX}.${expiresAt}.${accessToken}`)
    .digest("base64url");
}

function timingSafeCompare(providedValue: string, expectedValue: string): boolean {
  const provided = Buffer.from(providedValue);
  const expected = Buffer.from(expectedValue);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
