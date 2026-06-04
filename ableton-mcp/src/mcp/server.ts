import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ableton from "@ableton-extensions/sdk";
import { registerSongTools } from "./tools/song.js";
import { registerSelectionTool } from "./tools/selectionTool.js";
import { registerClipNotesTool } from "./tools/clipNotes.js";
import { registerAskUserTool } from "./tools/askUser.js";
import { registerGenerateTool } from "./tools/generate.js";

/** Build a fresh McpServer with all tools registered, closed over the live context. */
export function buildMcpServer(context: ableton.ExtensionContext<"1.0.0">): McpServer {
  const server = new McpServer({ name: "ableton-mcp", version: "0.0.1" });
  registerSongTools(server, context);
  registerSelectionTool(server);
  registerClipNotesTool(server, context);
  registerAskUserTool(server, context);
  registerGenerateTool(server, context);
  return server;
}
