import { loadAdminWebEnv, loadWorkspaceEnv } from "@platform/config";
import { createHmac, createPublicKey, createVerify, timingSafeEqual } from "node:crypto";

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
    clerkPublishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
    clerkJwtKey: env.CLERK_JWT_KEY?.trim(),
    clerkIssuer: env.CLERK_ISSUER?.trim(),
    clerkAuthorizedParties: parseCsv(env.CLERK_AUTHORIZED_PARTIES),
    clerkClockSkewSeconds: env.CLERK_CLOCK_SKEW_SECONDS,
    clerkSignInUrl: env.CLERK_SIGN_IN_URL,
    clerkSignUpUrl: env.CLERK_SIGN_UP_URL,
    clerkAfterSignInUrl: env.CLERK_AFTER_SIGN_IN_URL,
    clerkAfterSignUpUrl: env.CLERK_AFTER_SIGN_UP_URL,
    clerkSessionCookieName: env.ADMIN_WEB_CLERK_SESSION_COOKIE_NAME,
    apiInternalBaseUrl: env.API_INTERNAL_BASE_URL,
    cookieName: env.ADMIN_WEB_SESSION_COOKIE_NAME,
    sessionTtlSeconds: env.ADMIN_WEB_SESSION_TTL_SECONDS,
    secureCookie: env.NODE_ENV === "production"
  };
}

export function isClerkSessionVerificationConfigured(): boolean {
  return Boolean(getAdminWebConfig().clerkJwtKey);
}

export function isAdminWebSessionAuthenticated(
  clerkSessionCookie?: string,
  legacySessionCookie?: string
): boolean {
  if (isClerkSessionVerificationConfigured()) {
    return verifyClerkSessionToken(clerkSessionCookie);
  }

  return isValidAdminSessionCookie(legacySessionCookie);
}

export function verifyClerkSessionToken(value?: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  return verifyClerkSessionTokenDetailed(value, nowSeconds).valid;
}

export function verifyClerkSessionTokenDetailed(
  value?: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): { valid: true; reason: "valid" } | { valid: false; reason: string } {
  if (!value?.trim()) {
    return { valid: false, reason: "missing-token" };
  }

  const config = getAdminWebConfig();

  if (!config.clerkJwtKey) {
    return { valid: false, reason: "missing-jwt-key" };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = value.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return { valid: false, reason: "malformed-token" };
  }

  try {
    const header = parseBase64UrlJson(encodedHeader) as { alg?: unknown };

    if (header.alg !== "RS256") {
      return { valid: false, reason: "unsupported-algorithm" };
    }

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();

    const isSignatureValid = verifier.verify(
      createPublicKey(normalizePem(config.clerkJwtKey)),
      Buffer.from(encodedSignature, "base64url")
    );

    if (!isSignatureValid) {
      return { valid: false, reason: "invalid-signature" };
    }

    const claims = parseBase64UrlJson(encodedPayload) as {
      sub?: unknown;
      exp?: unknown;
      nbf?: unknown;
      iss?: unknown;
      azp?: unknown;
    };

    if (!claims.sub || typeof claims.sub !== "string") {
      return { valid: false, reason: "missing-subject" };
    }

    if (typeof claims.exp !== "number") {
      return { valid: false, reason: "invalid-expiration" };
    }

    if (claims.exp + config.clerkClockSkewSeconds <= nowSeconds) {
      return { valid: false, reason: `expired-clock-skew-${bucketSeconds(nowSeconds - claims.exp)}` };
    }

    if (
      claims.nbf !== undefined &&
      (typeof claims.nbf !== "number" || claims.nbf - config.clerkClockSkewSeconds > nowSeconds)
    ) {
      return { valid: false, reason: "invalid-not-before" };
    }

    if (config.clerkIssuer && claims.iss !== config.clerkIssuer) {
      return { valid: false, reason: "issuer-mismatch" };
    }

    if (config.clerkAuthorizedParties.length > 0) {
      if (typeof claims.azp === "string" && config.clerkAuthorizedParties.includes(claims.azp)) {
        return { valid: true, reason: "valid" };
      }

      return { valid: false, reason: "authorized-party-mismatch" };
    }

    return { valid: true, reason: "valid" };
  } catch {
    return { valid: false, reason: "verification-error" };
  }
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

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(request.url).origin;

  return Boolean(origin && origin === expectedOrigin);
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

function parseBase64UrlJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
}

function normalizePem(value: string): string {
  return value.includes("BEGIN PUBLIC KEY")
    ? value.replace(/\\n/g, "\n")
    : `-----BEGIN PUBLIC KEY-----\n${value.replace(/\s+/g, "")}\n-----END PUBLIC KEY-----`;
}

function parseCsv(value?: string): string[] {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

function bucketSeconds(value: number): string {
  if (value < 60) {
    return "under-1m";
  }

  if (value < 3600) {
    return "under-1h";
  }

  if (value < 86400) {
    return "under-1d";
  }

  if (value < 604800) {
    return "under-1w";
  }

  if (value < 2678400) {
    return "under-31d";
  }

  return "over-31d";
}
