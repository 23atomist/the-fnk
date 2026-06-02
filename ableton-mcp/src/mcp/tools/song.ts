import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiveContext } from "../../sdk/types.js";
import { serializeSongOverview } from "../../sdk/serialize.js";
import { withSafeHandler } from "../../core/errors.js";

export function registerSongTools(server: McpServer, context: LiveContext): void {
  server.registerTool(
    "get_song_overview",
    {
      title: "Get song overview",
      description:
        "Returns a snapshot of the current Live set: tempo, track names, return tracks, scenes, and the current scale.",
    },
    withSafeHandler("get_song_overview", async () => {
      const overview = serializeSongOverview(context);
      return { content: [{ type: "text", text: JSON.stringify(overview, null, 2) }] };
    }),
  );
}
