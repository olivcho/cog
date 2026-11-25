import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const platformDir = path.resolve(currentDir, "..");
const workspaceRoot = path.resolve(platformDir, "..");
const rootEnvPath = path.join(workspaceRoot, ".env");

const env = { ...process.env };

if (fs.existsSync(rootEnvPath)) {
  for (const rawLine of fs.readFileSync(rootEnvPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIndex = withoutExport.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = withoutExport.slice(0, eqIndex).trim();
    let value = withoutExport.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (env[key] === undefined) {
      env[key] = value;
    }
  }
}

if (!env.DATABASE_URL) {
  env.DATABASE_URL = "file:./dev.db";
}

const prismaBin = path.join(
  platformDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

execFileSync(prismaBin, ["db", "push", "--skip-generate"], {
  cwd: platformDir,
  env,
  stdio: "inherit",
});
