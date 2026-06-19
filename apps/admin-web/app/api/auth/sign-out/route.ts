import { NextResponse } from "next/server";
import { getAdminWebConfig, isSameOriginRequest } from "../../../lib/admin-access";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin sign-out requests are forbidden." }, { status: 403 });
  }

  const config = getAdminWebConfig();
  const response = NextResponse.json({ ok: true });

  response.cookies.set(config.clerkSessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie,
    maxAge: 0,
    path: "/"
  });
  response.cookies.set(config.cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie,
    maxAge: 0,
    path: "/"
  });

  return response;
}
