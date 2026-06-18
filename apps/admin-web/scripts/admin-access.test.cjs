const assert = require("node:assert/strict");
const { createSign, generateKeyPairSync } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const ts = require("typescript");
const { sanitizeAdminNextPath } = require("../app/lib/admin-next-path.cjs");

const ADMIN_WEB_ENV_KEYS = [
  "NODE_ENV",
  "API_INTERNAL_BASE_URL",
  "ADMIN_API_TOKEN",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_JWT_KEY",
  "CLERK_ISSUER",
  "CLERK_AUTHORIZED_PARTIES",
  "CLERK_CLOCK_SKEW_SECONDS",
  "CLERK_SIGN_IN_URL",
  "CLERK_SIGN_UP_URL",
  "CLERK_AFTER_SIGN_IN_URL",
  "CLERK_AFTER_SIGN_UP_URL",
  "ADMIN_WEB_CLERK_SESSION_COOKIE_NAME",
  "ADMIN_WEB_ACCESS_TOKEN",
  "ADMIN_WEB_SESSION_COOKIE_NAME",
  "ADMIN_WEB_SESSION_SECRET",
  "ADMIN_WEB_SESSION_TTL_SECONDS"
];

function runSourceSmokeAssertions() {
  assert.equal(sanitizeAdminNextPath("/admin"), "/admin");
  assert.equal(sanitizeAdminNextPath("/agent"), "/agent");
  assert.equal(sanitizeAdminNextPath("//external.example"), "/admin");
  assert.equal(sanitizeAdminNextPath("https://external.example/admin"), "/admin");
  assert.equal(sanitizeAdminNextPath("\\\\external.example\\admin"), "/admin");
  assert.equal(sanitizeAdminNextPath("/\\external"), "/admin");
  assert.equal(sanitizeAdminNextPath("admin"), "/admin");

  const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));
  const adminAccessSource = readFileSync(resolve(__dirname, "../app/lib/admin-access.ts"), "utf8");
  const adminProxySource = readFileSync(
    resolve(__dirname, "../app/api/admin/[...path]/route.ts"),
    "utf8"
  );
  const clerkSessionRouteSource = readFileSync(
    resolve(__dirname, "../app/api/auth/clerk/session/route.ts"),
    "utf8"
  );
  const adminPageSource = readFileSync(resolve(__dirname, "../app/admin/page.tsx"), "utf8");
  const adminKnowledgeBasePageSource = readFileSync(
    resolve(__dirname, "../app/admin/knowledge-base/page.tsx"),
    "utf8"
  );
  const adminConsoleSource = readFileSync(resolve(__dirname, "../app/components/admin-console.tsx"), "utf8");
  const middlewareSource = readFileSync(resolve(__dirname, "../middleware.ts"), "utf8");
  const agentPageSource = readFileSync(resolve(__dirname, "../app/agent/page.tsx"), "utf8");
  const clerkAuthPanelSource = readFileSync(
    resolve(__dirname, "../app/components/clerk-auth-panel.tsx"),
    "utf8"
  );
  const answerDebugPanelSource = readFileSync(
    resolve(__dirname, "../app/components/answer-debug-panel.tsx"),
    "utf8"
  );
  const knowledgeBasePanelSource = readFileSync(
    resolve(__dirname, "../app/components/knowledge-base-panel.tsx"),
    "utf8"
  );

  assert.equal(packageJson.dependencies["@platform/config"], "workspace:*");
  assert.match(adminAccessSource, /loadWorkspaceEnv/);
  assert.match(adminAccessSource, /loadAdminWebEnv/);
  assert.match(adminAccessSource, /ADMIN_WEB_CLERK_SESSION_COOKIE_NAME/);
  assert.match(adminAccessSource, /verifyClerkSessionToken/);
  assert.match(adminAccessSource, /createVerify/);
  assert.match(adminAccessSource, /CLERK_JWT_KEY/);
  assert.match(adminAccessSource, /claims\.sub/);
  assert.match(adminAccessSource, /typeof claims\.exp !== "number"/);
  assert.doesNotMatch(adminAccessSource, /loadServerEnv/);
  assert.match(adminProxySource, /authorization/);
  assert.match(adminProxySource, /Bearer/);
  assert.match(adminProxySource, /x-admin-api-token/);
  assert.match(adminProxySource, /verifyClerkSessionToken/);
  assert.match(clerkSessionRouteSource, /httpOnly: true/);
  assert.match(clerkSessionRouteSource, /verifyClerkSessionToken/);
  assert.doesNotMatch(clerkSessionRouteSource, /hasClerkSessionCookie/);
  assert.match(adminPageSource, /verifyClerkSessionToken/);
  assert.match(adminKnowledgeBasePageSource, /verifyClerkSessionToken/);
  assert.match(adminKnowledgeBasePageSource, /redirect_url=\/admin\/knowledge-base/);
  assert.match(adminKnowledgeBasePageSource, /view="knowledge"/);
  assert.match(adminConsoleSource, /\/admin\/knowledge-base/);
  assert.doesNotMatch(adminConsoleSource, /target: "knowledge"/);
  assert.match(middlewareSource, /\/admin\/:path\*/);
  assert.match(agentPageSource, /verifyClerkSessionToken/);
  assert.doesNotMatch(adminPageSource, /hasClerkSessionCookie/);
  assert.doesNotMatch(agentPageSource, /hasClerkSessionCookie/);
  assert.match(clerkAuthPanelSource, /publishableKey/);
  assert.doesNotMatch(clerkAuthPanelSource, /CLERK_SECRET_KEY|ADMIN_API_TOKEN|OPENAI_API_KEY|localStorage/);

  assert.match(answerDebugPanelSource, /\/chat\/answer-debug/);
  assert.match(answerDebugPanelSource, /Retrieved chunks/);
  assert.match(answerDebugPanelSource, /Safe provider metadata/);
  assert.doesNotMatch(answerDebugPanelSource, /ADMIN_API_TOKEN|OPENAI_API_KEY|NEXT_PUBLIC_ADMIN/);
  assert.match(knowledgeBasePanelSource, /Chunk Preview/);
  assert.match(knowledgeBasePanelSource, /reprocess/);
  assert.match(knowledgeBasePanelSource, /archive/);
  assert.match(knowledgeBasePanelSource, /delete/);
}

function loadTranspiledModule(relativePath, requireMap = {}) {
  const absolutePath = resolve(__dirname, "..", relativePath);
  const source = readFileSync(absolutePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: absolutePath
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(requireMap, specifier)) {
      return requireMap[specifier];
    }

    if (specifier.startsWith(".")) {
      const resolved = resolve(dirname(absolutePath), specifier);
      const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`];
      const mapped = candidates.find((candidate) =>
        Object.prototype.hasOwnProperty.call(requireMap, candidate)
      );

      if (mapped) {
        return requireMap[mapped];
      }
    }

    return require(specifier);
  };

  Function("exports", "require", "module", "__filename", "__dirname", output)(
    module.exports,
    localRequire,
    module,
    absolutePath,
    dirname(absolutePath)
  );

  return module.exports;
}

function createAdminWebConfigStub() {
  return {
    loadWorkspaceEnv: () => undefined,
    loadAdminWebEnv: (source) => ({
      NODE_ENV: source.NODE_ENV ?? "development",
      API_INTERNAL_BASE_URL: source.API_INTERNAL_BASE_URL ?? "http://localhost:4000/v1",
      ADMIN_API_TOKEN: source.ADMIN_API_TOKEN,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: source.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      CLERK_JWT_KEY: source.CLERK_JWT_KEY,
      CLERK_ISSUER: source.CLERK_ISSUER,
      CLERK_AUTHORIZED_PARTIES: source.CLERK_AUTHORIZED_PARTIES,
      CLERK_CLOCK_SKEW_SECONDS: source.CLERK_CLOCK_SKEW_SECONDS
        ? Number(source.CLERK_CLOCK_SKEW_SECONDS)
        : 0,
      CLERK_SIGN_IN_URL: source.CLERK_SIGN_IN_URL ?? "/sign-in",
      CLERK_SIGN_UP_URL: source.CLERK_SIGN_UP_URL ?? "/sign-up",
      CLERK_AFTER_SIGN_IN_URL: source.CLERK_AFTER_SIGN_IN_URL ?? "/admin",
      CLERK_AFTER_SIGN_UP_URL: source.CLERK_AFTER_SIGN_UP_URL ?? "/admin",
      ADMIN_WEB_CLERK_SESSION_COOKIE_NAME:
        source.ADMIN_WEB_CLERK_SESSION_COOKIE_NAME ?? "platform_clerk_session",
      ADMIN_WEB_ACCESS_TOKEN: source.ADMIN_WEB_ACCESS_TOKEN,
      ADMIN_WEB_SESSION_COOKIE_NAME: source.ADMIN_WEB_SESSION_COOKIE_NAME ?? "platform_admin_session",
      ADMIN_WEB_SESSION_SECRET: source.ADMIN_WEB_SESSION_SECRET,
      ADMIN_WEB_SESSION_TTL_SECONDS: source.ADMIN_WEB_SESSION_TTL_SECONDS
        ? Number(source.ADMIN_WEB_SESSION_TTL_SECONDS)
        : 43200
    })
  };
}

class TestCookieJar {
  constructor() {
    this.setCalls = [];
  }

  set(name, value, options) {
    this.setCalls.push({ name, value, options });
  }
}

class TestNextResponse extends Response {
  constructor(body, init) {
    super(body, init);
    this.cookies = new TestCookieJar();
  }

  static json(payload, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");

    return new TestNextResponse(JSON.stringify(payload), {
      ...init,
      headers
    });
  }
}

function createCookieStore(values) {
  return {
    get: (name) => {
      const value = values[name];

      return value ? { value } : undefined;
    }
  };
}

function createClerkTestKeys() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    }
  });
}

function createClerkTestToken(privateKey, claims = {}) {
  const header = encodeJwtPart({
    alg: "RS256",
    typ: "JWT"
  });
  const payloadClaims = {
    sub: "user-test",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims
  };
  const payload = encodeJwtPart(payloadClaims);
  const signer = createSign("RSA-SHA256");

  signer.update(`${header}.${payload}`);
  signer.end();

  return `${header}.${payload}.${signer.sign(privateKey, "base64url")}`;
}

function createForgedTokenShape() {
  return `${encodeJwtPart({ alg: "RS256", typ: "JWT" })}.${encodeJwtPart({
    sub: "user-forged",
    exp: Math.floor(Date.now() / 1000) + 3600
  })}.forged-signature`;
}

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function withAdminWebEnv(overrides, callback) {
  const previous = {};

  for (const key of ADMIN_WEB_ENV_KEYS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }

  Object.assign(process.env, overrides);

  try {
    return await callback();
  } finally {
    for (const key of ADMIN_WEB_ENV_KEYS) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

function cookieSetCalls(response) {
  return response.cookies?.setCalls ?? [];
}

function createRedirectStub() {
  return (url) => {
    const error = new Error("redirect");
    error.redirectUrl = url;
    throw error;
  };
}

async function runRuntimeAssertions() {
  const adminAccess = loadTranspiledModule("app/lib/admin-access.ts", {
    "@platform/config": createAdminWebConfigStub()
  });
  const sessionRoute = loadTranspiledModule("app/api/auth/clerk/session/route.ts", {
    "next/server": { NextResponse: TestNextResponse },
    "../../../../lib/admin-access": adminAccess,
    [resolve(__dirname, "../app/lib/admin-access")]: adminAccess,
    [resolve(__dirname, "../app/lib/admin-access.ts")]: adminAccess
  });
  let currentCookieStore = createCookieStore({});
  const proxyRoute = loadTranspiledModule("app/api/admin/[...path]/route.ts", {
    "next/headers": {
      cookies: () => currentCookieStore
    },
    "next/server": { NextResponse: TestNextResponse },
    "../../../lib/admin-access": adminAccess,
    [resolve(__dirname, "../app/lib/admin-access")]: adminAccess,
    [resolve(__dirname, "../app/lib/admin-access.ts")]: adminAccess
  });
  const jsxRuntime = {
    Fragment: Symbol("Fragment"),
    jsx: () => ({}),
    jsxs: () => ({})
  };
  const adminPage = loadTranspiledModule("app/admin/page.tsx", {
    "next/headers": {
      cookies: () => currentCookieStore
    },
    "next/navigation": {
      redirect: createRedirectStub()
    },
    "react/jsx-runtime": jsxRuntime,
    "../components/admin-console": {
      AdminConsole: () => null
    },
    "../lib/admin-access": adminAccess,
    [resolve(__dirname, "../app/lib/admin-access")]: adminAccess,
    [resolve(__dirname, "../app/lib/admin-access.ts")]: adminAccess
  }).default;
  const agentPage = loadTranspiledModule("app/agent/page.tsx", {
    "next/headers": {
      cookies: () => currentCookieStore
    },
    "next/navigation": {
      redirect: createRedirectStub()
    },
    "react/jsx-runtime": jsxRuntime,
    "../components/agent-console": {
      AgentConsole: () => null
    },
    "../lib/admin-access": adminAccess,
    [resolve(__dirname, "../app/lib/admin-access")]: adminAccess,
    [resolve(__dirname, "../app/lib/admin-access.ts")]: adminAccess
  }).default;
  const { publicKey, privateKey } = createClerkTestKeys();
  const otherKeys = createClerkTestKeys();
  const validToken = createClerkTestToken(privateKey, {
    iss: "https://clerk.example.test",
    azp: "http://localhost:3000"
  });
  const forgedToken = createForgedTokenShape();

  await withAdminWebEnv(
    {
      CLERK_JWT_KEY: publicKey,
      CLERK_ISSUER: "https://clerk.example.test",
      CLERK_AUTHORIZED_PARTIES: "http://localhost:3000"
    },
    async () => {
      assert.equal(adminAccess.verifyClerkSessionToken(validToken), true);
      assert.equal(adminAccess.verifyClerkSessionToken(forgedToken), false);
      assert.equal(adminAccess.verifyClerkSessionToken(createClerkTestToken(otherKeys.privateKey)), false);
      assert.equal(adminAccess.verifyClerkSessionToken(createClerkTestToken(privateKey, { sub: undefined })), false);
      assert.equal(adminAccess.verifyClerkSessionToken(createClerkTestToken(privateKey, { exp: undefined })), false);
      assert.equal(
        adminAccess.verifyClerkSessionToken(createClerkTestToken(privateKey, {
          exp: Math.floor(Date.now() / 1000) - 120
        })),
        false
      );
      assert.equal(
        adminAccess.verifyClerkSessionToken(
          createClerkTestToken(privateKey, {
            iss: "https://wrong-issuer.example.test",
            azp: "http://localhost:3000"
          })
        ),
        false
      );
      assert.equal(
        adminAccess.verifyClerkSessionToken(
          createClerkTestToken(privateKey, {
            iss: "https://clerk.example.test",
            azp: "http://evil.example.test"
          })
        ),
        false
      );
    }
  );

  await withAdminWebEnv(
    {
      CLERK_JWT_KEY: publicKey,
      CLERK_CLOCK_SKEW_SECONDS: "3600"
    },
    async () => {
      assert.equal(
        adminAccess.verifyClerkSessionToken(createClerkTestToken(privateKey, {
          exp: Math.floor(Date.now() / 1000) - 120
        })),
        true
      );
    }
  );

  await withAdminWebEnv({}, async () => {
    const response = await sessionRoute.POST(
      new Request("http://localhost:3000/api/auth/clerk/session", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ token: validToken })
      })
    );

    assert.equal(response.status, 500);
    assert.deepEqual(cookieSetCalls(response), []);
  });

  await withAdminWebEnv({ CLERK_JWT_KEY: "not-a-public-key" }, async () => {
    const response = await sessionRoute.POST(
      new Request("http://localhost:3000/api/auth/clerk/session", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ token: validToken })
      })
    );

    assert.equal(response.status, 401);
    assert.deepEqual(cookieSetCalls(response), []);
  });

  await withAdminWebEnv({ CLERK_JWT_KEY: publicKey }, async () => {
    const response = await sessionRoute.POST(
      new Request("http://localhost:3000/api/auth/clerk/session", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ token: forgedToken })
      })
    );

    assert.equal(response.status, 401);
    assert.deepEqual(cookieSetCalls(response), []);
  });

  await withAdminWebEnv({ CLERK_JWT_KEY: publicKey }, async () => {
    const response = await sessionRoute.POST(
      new Request("http://localhost:3000/api/auth/clerk/session", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ token: validToken })
      })
    );
    const cookie = cookieSetCalls(response).find((call) => call.name === "platform_clerk_session");

    assert.equal(response.status, 200);
    assert.ok(cookie);
    assert.equal(cookie.value, validToken);
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, "lax");
    assert.equal(cookie.options.path, "/");
  });

  await withAdminWebEnv({ CLERK_JWT_KEY: publicKey }, async () => {
    currentCookieStore = createCookieStore({
      platform_clerk_session: forgedToken
    });

    assert.throws(() => adminPage(), (error) => error.redirectUrl === "/sign-in?redirect_url=/admin");
    assert.throws(() => agentPage(), (error) => error.redirectUrl === "/sign-in?redirect_url=/agent");
  });

  await withAdminWebEnv({ CLERK_JWT_KEY: publicKey }, async () => {
    let capturedFetch;
    const originalFetch = global.fetch;
    global.fetch = async (targetUrl, init) => {
      capturedFetch = { targetUrl, init };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    };
    currentCookieStore = createCookieStore({
      platform_clerk_session: forgedToken
    });

    try {
      const response = await proxyRoute.GET(new Request("http://localhost:3000/api/admin/tenants"), {
        params: {
          path: ["tenants"]
        }
      });

      assert.equal(response.status, 401);
      assert.equal(capturedFetch, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await withAdminWebEnv({ CLERK_JWT_KEY: publicKey }, async () => {
    let capturedFetch;
    const originalFetch = global.fetch;
    global.fetch = async (targetUrl, init) => {
      capturedFetch = { targetUrl, init };
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    };
    currentCookieStore = createCookieStore({
      platform_clerk_session: validToken
    });

    try {
      const response = await proxyRoute.GET(new Request("http://localhost:3000/api/admin/tenants"), {
        params: {
          path: ["tenants"]
        }
      });

      assert.equal(response.status, 200);
      assert.equal(capturedFetch.init.headers.get("authorization"), `Bearer ${validToken}`);
      assert.equal(capturedFetch.init.headers.has("x-admin-api-token"), false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  await withAdminWebEnv(
    {
      CLERK_JWT_KEY: publicKey,
      ADMIN_API_TOKEN: "server-only-admin-token",
      ADMIN_WEB_ACCESS_TOKEN: "local-access-token",
      ADMIN_WEB_SESSION_SECRET: "local-session-secret"
    },
    async () => {
      let capturedFetch;
      const originalFetch = global.fetch;
      const legacySession = adminAccess.createAdminSessionCookieValue();
      global.fetch = async (targetUrl, init) => {
        capturedFetch = { targetUrl, init };
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      };
      currentCookieStore = createCookieStore({
        platform_clerk_session: forgedToken,
        platform_admin_session: legacySession
      });

      try {
        const response = await proxyRoute.GET(new Request("http://localhost:3000/api/admin/tenants"), {
          params: {
            path: ["tenants"]
          }
        });

        assert.equal(response.status, 200);
        assert.equal(capturedFetch.init.headers.get("x-admin-api-token"), "server-only-admin-token");
        assert.equal(capturedFetch.init.headers.has("authorization"), false);
      } finally {
        global.fetch = originalFetch;
      }
    }
  );
}

async function main() {
  runSourceSmokeAssertions();
  await runRuntimeAssertions();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
