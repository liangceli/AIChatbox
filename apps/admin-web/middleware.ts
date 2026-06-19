import { NextResponse, type NextRequest } from "next/server";

const CLERK_SESSION_COOKIE = process.env.ADMIN_WEB_CLERK_SESSION_COOKIE_NAME || "platform_clerk_session";
const LEGACY_SESSION_COOKIE = process.env.ADMIN_WEB_SESSION_COOKIE_NAME || "platform_admin_session";
const SIGN_IN_URL = process.env.CLERK_SIGN_IN_URL || "/sign-in";

export function middleware(request: NextRequest) {
  const hasClerkSession = Boolean(request.cookies.get(CLERK_SESSION_COOKIE)?.value);
  const hasLegacySession = Boolean(request.cookies.get(LEGACY_SESSION_COOKIE)?.value);

  if (hasClerkSession || hasLegacySession) {
    return NextResponse.next();
  }

  const signInUrl = new URL(SIGN_IN_URL, request.url);
  signInUrl.searchParams.set("redirect_url", request.nextUrl.pathname);

  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/agent", "/account", "/access-pending"]
};
