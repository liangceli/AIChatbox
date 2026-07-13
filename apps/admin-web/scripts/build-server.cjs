const { rmSync } = require("node:fs");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");

const appRoot = resolve(__dirname, "..");
const nextDir = resolve(appRoot, ".next");

// Next build can occasionally reuse stale app-router artifacts on Windows
// after repeated local dev/build cycles. Clear only local compilation output.
rmSync(nextDir, { recursive: true, force: true });

const nextBin = resolve(appRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "build"], {
  cwd: appRoot,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
