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

assert.equal(packageJson.dependencies["@platform/config"], "workspace:*");
assert.match(adminAccessSource, /loadWorkspaceEnv/);
assert.match(adminAccessSource, /loadAdminWebEnv/);
assert.doesNotMatch(adminAccessSource, /loadServerEnv/);
