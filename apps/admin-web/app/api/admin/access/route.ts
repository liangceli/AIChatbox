import { NextResponse } from "next/server";
import {
  createAdminSessionCookieValue,
  getAdminWebConfig,
  isValidAccessToken
} from "../../../lib/admin-access";

export async function POST(request: Request) {
  let token = "";

  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ error: "Invalid access request." }, { status: 400 });
  }

  try {
    if (!isValidAccessToken(token)) {
      return NextResponse.json({ error: "Invalid admin web access token." }, { status: 403 });
    }

    const config = getAdminWebConfig();
    const response = NextResponse.json({ ok: true });

    response.cookies.set(config.cookieName, createAdminSessionCookieValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: config.secureCookie,
      maxAge: config.sessionTtlSeconds,
      path: "/"
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Admin web access is not configured." }, { status: 500 });
  }
}
