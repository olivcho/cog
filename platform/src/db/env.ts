import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = path.resolve(currentDir, "../../..");

export function parseEnvContent(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
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
    parsed[key] = value;
  }
  return parsed;
}

export function loadWorkspaceEnv(
  envFilePath: string = path.join(defaultWorkspaceRoot, ".env"),
  targetEnv: Record<string, string | undefined> = process.env,
): void {
  if (!fs.existsSync(envFilePath)) return;
  const parsed = parseEnvContent(fs.readFileSync(envFilePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }
}
