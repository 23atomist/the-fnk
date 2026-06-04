import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ableton from "@ableton-extensions/sdk";
import { getActiveSelection } from "../../selection/activeSelection.js";
import { validateNotes } from "../../agent/notes.js";
import { resolvePlacement } from "./resolvePlacement.js";
import { withSafeHandler } from "../../core/errors.js";
import { log } from "../../core/logger.js";

const NoteShape = z.object({
  pitch: z.number(),
  startTime: z.number(),
  duration: z.number(),
  velocity: z.number().optional(),
});

const ClipShape = z.object({
  trackIndex: z.number().optional(),
  sceneIndex: z.number().optional(),
  trackOffset: z.number().optional(),
  sceneOffset: z.number().optional(),
  lengthBeats: z.number(),
  name: z.string().optional(),
  notes: z.array(NoteShape),
});

/** Exported for unit testing the schema. */
export const ClipsInputShape = { clips: z.array(ClipShape) };

type ClipInput = z.infer<typeof ClipShape>;
type ClipsArgs = z.infer<ReturnType<typeof z.object<typeof ClipsInputShape>>>;

export function registerGenerateTool(
  server: McpServer,
  context: ableton.ExtensionContext<"1.0.0">,
): void {
  server.registerTool(
    "create_midi_clips",
    {
      title: "Create MIDI clips",
      description:
        "Batch-create MIDI clips with notes in Session clip slots, applied as a single undo step. " +
        "Each clip targets song.tracks[trackIndex].clipSlots[sceneIndex]. Placement can be absolute " +
        "(trackIndex/sceneIndex) or relative to the selected cell via trackOffset/sceneOffset — e.g. " +
        "sceneOffset:1 is the row directly underneath the selection, trackOffset:1 the next track. " +
        "Omitted axes default to the selected track/scene. Times are in beats (0 = clip start). Only " +
        "empty slots on MIDI tracks are filled; occupied/non-MIDI/out-of-range targets are skipped and " +
        "reported. Decide column (same track, consecutive scenes) vs row (same scene, consecutive tracks) " +
        "from the producer's wording.",
      inputSchema: ClipsInputShape,
    },
    withSafeHandler("create_midi_clips", async (args: ClipsArgs) => {
      const sel = getActiveSelection();
      log.info(`create_midi_clips: called with ${args.clips.length} clip(s)`);
      const song = context.application.song;
      const skipped: Array<{ trackIndex: number | null; sceneIndex: number; reason: string }> = [];
      const plans: Array<{ slot: ableton.ClipSlot<"1.0.0">; lengthBeats: number; notes: ableton.NoteDescription[]; name?: string; trackIndex: number; sceneIndex: number }> = [];
      const seen = new Set<string>();

      for (const c of args.clips) {
        const resolved = resolvePlacement(c, sel);
        if (!resolved.ok) { skipped.push({ trackIndex: resolved.trackIndex, sceneIndex: resolved.sceneIndex ?? -1, reason: resolved.reason }); continue; }
        const { trackIndex, sceneIndex } = resolved;
        const key = `${trackIndex}:${sceneIndex}`;
        if (seen.has(key)) { skipped.push({ trackIndex, sceneIndex, reason: "duplicate in batch" }); continue; }
        seen.add(key);
        const track = song.tracks[trackIndex];
        if (!track) { skipped.push({ trackIndex, sceneIndex, reason: `track ${trackIndex} out of range` }); continue; }
        if (!(track instanceof ableton.MidiTrack)) { skipped.push({ trackIndex, sceneIndex, reason: "not a MIDI track" }); continue; }
        const slot = track.clipSlots[sceneIndex];
        if (!slot) { skipped.push({ trackIndex, sceneIndex, reason: `scene ${sceneIndex} out of range` }); continue; }
        if (slot.clip != null) { skipped.push({ trackIndex, sceneIndex, reason: "slot occupied" }); continue; }
        plans.push({ slot, lengthBeats: c.lengthBeats, notes: validateNotes(c.notes) as ableton.NoteDescription[], name: c.name, trackIndex, sceneIndex });
      }

      if (plans.length > 0) {
        await context.withinTransaction(() =>
          Promise.all(plans.map(async (p) => {
            const clip = await p.slot.createMidiClip(p.lengthBeats);
            clip.notes = p.notes;
            if (p.name != null) clip.name = p.name;
          })),
        );
      }

      // Reached only on full transaction success (withSafeHandler turns any throw into isError).
      const createdScenes = plans.map((p) => p.sceneIndex);
      log.info(`create_midi_clips: created ${plans.length} [${createdScenes.join(",")}], skipped ${skipped.length}${skipped.length ? ` — ${JSON.stringify(skipped)}` : ""}`);
      return { content: [{ type: "text", text: JSON.stringify({ created: plans.length, createdScenes, skipped }) }] };
    }),
  );
}
