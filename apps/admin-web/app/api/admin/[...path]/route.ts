import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertAdminWebAccessConfigured, isValidAdminSessionCookie } from "../../../lib/admin-access";

type RouteContext = {
  params: {
    path?: string[];
  };
};

export async function GET(request: Request, context: RouteContext) {
  return proxyAdminRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyAdminRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyAdminRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyAdminRequest(request, context);
}

async function proxyAdminRequest(request: Request, context: RouteContext) {
  let config: ReturnType<typeof assertAdminWebAccessConfigured>;

  try {
    config = assertAdminWebAccessConfigured();
  } catch {
    return NextResponse.json({ error: "Admin proxy is not configured." }, { status: 500 });
  }

  const sessionCookie = cookies().get(config.cookieName)?.value;

  if (!isValidAdminSessionCookie(sessionCookie)) {
    return NextResponse.json({ error: "Admin web access is required." }, { status: 401 });
  }

  const targetUrl = buildTargetUrl(config.apiInternalBaseUrl, context.params.path ?? [], request.url);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const tenantSlug = request.headers.get("x-tenant-slug");

  headers.set("x-admin-api-token", config.adminApiToken);

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (tenantSlug) {
    headers.set("x-tenant-slug", tenantSlug);
  }

  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : await request.arrayBuffer(),
    cache: "no-store"
  });

  const responseHeaders = new Headers();
  const upstreamContentType = upstreamResponse.headers.get("content-type");
  const cacheControl = upstreamResponse.headers.get("cache-control");

  if (upstreamContentType) {
    responseHeaders.set("content-type", upstreamContentType);
  }

  if (cacheControl) {
    responseHeaders.set("cache-control", cacheControl);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}

function buildTargetUrl(apiBaseUrl: string, path: string[], requestUrl: string): string {
  const normalizedBaseUrl = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  const targetUrl = new URL(path.map(encodeURIComponent).join("/"), normalizedBaseUrl);
  targetUrl.search = new URL(requestUrl).search;

  return targetUrl.toString();
}
