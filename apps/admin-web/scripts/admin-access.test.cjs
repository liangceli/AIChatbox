const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { sanitizeAdminNextPath } = require("../app/lib/admin-next-path.cjs");

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
assert.doesNotMatch(adminAccessSource, /loadServerEnv/);
assert.match(adminProxySource, /authorization/);
assert.match(adminProxySource, /Bearer/);
assert.match(adminProxySource, /x-admin-api-token/);
assert.match(adminProxySource, /verifyClerkSessionToken/);
assert.match(clerkSessionRouteSource, /httpOnly: true/);
assert.match(clerkSessionRouteSource, /verifyClerkSessionToken/);
assert.doesNotMatch(clerkSessionRouteSource, /hasClerkSessionCookie/);
assert.match(adminPageSource, /verifyClerkSessionToken/);
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
