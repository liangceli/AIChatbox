const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const source = readFileSync(resolve(__dirname, "..", "src", "index.ts"), "utf8");

assert.match(source, /redisConfigured:\s*Boolean\(env\.REDIS_URL\?\.trim\(\)\)/);
assert.doesNotMatch(source, /redisUrl:\s*env\.REDIS_URL/);
