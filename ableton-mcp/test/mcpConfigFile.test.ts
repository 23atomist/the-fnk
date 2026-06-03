import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { writeMcpConfig } from "../src/agent/mcpConfigFile.js";

describe("writeMcpConfig", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ablcfg-"));
  });

  it("writes a 0600 JSON config pointing at the local MCP server with the bearer token", () => {
    const file = writeMcpConfig({ dir, host: "127.0.0.1", port: 9787, token: "t0ken", path: "/mcp" });
    const mode = fs.statSync(file).mode & 0o777;
    expect(mode).toBe(0o600);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(parsed.mcpServers.ableton.type).toBe("http");
    expect(parsed.mcpServers.ableton.url).toBe("http://127.0.0.1:9787/mcp");
    expect(parsed.mcpServers.ableton.headers.Authorization).toBe("Bearer t0ken");
  });
});
