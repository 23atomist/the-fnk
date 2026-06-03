import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActiveSelection } from "../../selection/activeSelection.js";
import { withSafeHandler } from "../../core/errors.js";

/** Pure: shape the active selection into the tool's JSON result. */
export function serializeActiveSelection(): Record<string, unknown> {
  const sel = getActiveSelection();
  if (sel === null) return { hasSelection: false };
  return { hasSelection: true, ...sel };
}

export function registerSelectionTool(server: McpServer): void {
  server.registerTool(
    "get_selection",
    {
      title: "Get current selection",
      description:
        "Returns the Session cell the producer right-clicked: trackIndex, trackName, isMidiTrack, sceneIndex, hasClip, totalTracks, totalScenes. Use it to decide where to place clips.",
    },
    withSafeHandler("get_selection", async () => {
      return { content: [{ type: "text", text: JSON.stringify(serializeActiveSelection(), null, 2) }] };
    }),
  );
}
