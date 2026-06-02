import * as path from "node:path";
import * as os from "node:os";

export const HOST = "127.0.0.1";
function resolvePort(raw: string | undefined): number {
  if (raw === undefined) return 9787;
  const n = parseInt(raw, 10);
  if (Number.isInteger(n) && n > 0 && n < 65536) return n;
  console.warn(`[ableton-mcp] ABLETON_MCP_PORT "${raw}" is not a valid port; using 9787`);
  return 9787;
}

export const PORT = resolvePort(process.env.ABLETON_MCP_PORT);
export const MCP_PATH = "/mcp";

/** Where the bearer token is persisted. Prefers the SDK storage dir; falls back to tmp. */
export function tokenFilePath(storageDirectory: string | undefined): string {
  const dir = storageDirectory ?? os.tmpdir();
  return path.join(dir, "ableton-mcp-token");
}
