import { NextResponse } from "next/server";
import {
  getAdminWebConfig,
  isClerkSessionVerificationConfigured,
  verifyClerkSessionToken
} from "../../../../lib/admin-access";

export async function POST(request: Request) {
  let token = "";

  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid Clerk session request." }, { status: 400 });
  }

  if (!isClerkSessionVerificationConfigured()) {
    return NextResponse.json({ error: "Clerk session verification is not configured." }, { status: 500 });
  }

  if (!verifyClerkSessionToken(token)) {
    return NextResponse.json({ error: "Invalid Clerk session token." }, { status: 401 });
  }

  const config = getAdminWebConfig();
  const response = NextResponse.json({ ok: true });

  response.cookies.set(config.clerkSessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie,
    maxAge: config.sessionTtlSeconds,
    path: "/"
  });

  return response;
}
