import { NextResponse } from "next/server";
import { getAdminWebConfig } from "../../../lib/admin-access";

export async function POST() {
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
