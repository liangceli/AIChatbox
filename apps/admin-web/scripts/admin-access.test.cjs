const assert = require("node:assert/strict");
const { sanitizeAdminNextPath } = require("../app/lib/admin-next-path.cjs");

assert.equal(sanitizeAdminNextPath("/admin"), "/admin");
assert.equal(sanitizeAdminNextPath("/agent"), "/agent");
assert.equal(sanitizeAdminNextPath("//external.example"), "/admin");
assert.equal(sanitizeAdminNextPath("https://external.example/admin"), "/admin");
assert.equal(sanitizeAdminNextPath("\\\\external.example\\admin"), "/admin");
assert.equal(sanitizeAdminNextPath("/\\external"), "/admin");
assert.equal(sanitizeAdminNextPath("admin"), "/admin");
