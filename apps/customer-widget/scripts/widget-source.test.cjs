const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));
const widgetSource = readFileSync(resolve(__dirname, "../src/widget.tsx"), "utf8");

assert.match(packageJson.scripts.dev, /tsup \.\/\.\/src\/index\.ts/);
assert.match(packageJson.scripts.build, /tsup \.\/\.\/src\/index\.ts/);
assert.match(widgetSource, /setIsSending\(true\);\s*setDraft\(""\);/s);
assert.match(widgetSource, /catch \(submissionError: unknown\) \{\s*setDraft\(message\);/s);
