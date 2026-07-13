const { rmSync } = require("node:fs");
const { spawn } = require("node:child_process");
const { resolve } = require("node:path");

const appRoot = resolve(__dirname, "..");
const nextDir = resolve(appRoot, ".next");

// Next dev can occasionally serve stale CSS/HMR artifacts on Windows after
// repeated restarts. Clear only the local compilation output before startup.
rmSync(nextDir, { recursive: true, force: true });

const nextBin = resolve(appRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev"], {
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
