import * as fs from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";

export interface McpConfigOptions {
  dir: string;
  host: string;
  port: number;
  token: string;
  path: string; // MCP endpoint path, e.g. "/mcp"
}

/** Write a temp `--mcp-config` JSON (0600) describing our localhost MCP server. Returns its path. */
export function writeMcpConfig(opts: McpConfigOptions): string {
  const config = {
    mcpServers: {
      ableton: {
        type: "http",
        url: `http://${opts.host}:${opts.port}${opts.path}`,
        headers: { Authorization: `Bearer ${opts.token}` },
      },
    },
  };
  const file = path.join(opts.dir, `ableton-mcp-claude-config-${randomBytes(6).toString("hex")}.json`);
  fs.writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
  return file;
}
