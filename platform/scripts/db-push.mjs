import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const platformDir = path.resolve(currentDir, "..");
const workspaceRoot = path.resolve(platformDir, "..");
const rootEnvPath = path.join(workspaceRoot, ".env");

const env = { ...process.env };

if (fs.existsSync(rootEnvPath)) {
  const parsed = parse(fs.readFileSync(rootEnvPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
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
