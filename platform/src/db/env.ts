import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = path.resolve(currentDir, "../../..");

export function loadWorkspaceEnv(
  envFilePath: string = path.join(defaultWorkspaceRoot, ".env"),
  targetEnv: Record<string, string | undefined> = process.env,
): void {
  if (!fs.existsSync(envFilePath)) return;
  const parsed = parse(fs.readFileSync(envFilePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }
}
