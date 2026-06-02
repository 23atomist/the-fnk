import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiveContext } from "../sdk/types.js";
import { registerSongTools } from "./tools/song.js";

/** Build a fresh McpServer with all tools registered, closed over the live context. */
export function buildMcpServer(context: LiveContext): McpServer {
  const server = new McpServer({ name: "ableton-mcp", version: "0.0.1" });
  registerSongTools(server, context);
  return server;
}
