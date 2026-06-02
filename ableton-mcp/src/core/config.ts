import * as path from "node:path";
import * as os from "node:os";

export const HOST = "127.0.0.1";
export const PORT = Number(process.env.ABLETON_MCP_PORT ?? 9787);
export const MCP_PATH = "/mcp";

/** Where the bearer token is persisted. Prefers the SDK storage dir; falls back to tmp. */
export function tokenFilePath(storageDirectory: string | undefined): string {
  const dir = storageDirectory ?? os.tmpdir();
  return path.join(dir, "ableton-mcp-token");
}
