import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ableton from "@ableton-extensions/sdk";
import { getActiveSelection } from "../../selection/activeSelection.js";
import { validateNotes } from "../../agent/notes.js";
import { withSafeHandler } from "../../core/errors.js";

const NoteShape = z.object({
  pitch: z.number(),
  startTime: z.number(),
  duration: z.number(),
  velocity: z.number().optional(),
});

const ClipShape = z.object({
  trackIndex: z.number().optional(),
  sceneIndex: z.number(),
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
        "Each clip targets song.tracks[trackIndex].clipSlots[sceneIndex]; trackIndex defaults to the " +
        "selected track. Times are in beats (0 = clip start). Only empty slots on MIDI tracks are filled; " +
        "occupied/non-MIDI/out-of-range targets are skipped and reported. Decide column (same track, " +
        "consecutive scenes) vs row (same scene, consecutive tracks) from the producer's wording.",
      inputSchema: ClipsInputShape,
    },
    withSafeHandler("create_midi_clips", async (args: ClipsArgs) => {
      const sel = getActiveSelection();
      const song = context.application.song;
      const skipped: Array<{ sceneIndex: number; reason: string }> = [];
      const plans: Array<{
        slot: ableton.ClipSlot<"1.0.0">;
        lengthBeats: number;
        notes: ableton.NoteDescription[];
        sceneIndex: number;
      }> = [];

      for (const c of args.clips) {
        const clipInput = c as ClipInput;
        const trackIndex = clipInput.trackIndex ?? sel?.trackIndex;
        if (trackIndex == null) {
          skipped.push({ sceneIndex: clipInput.sceneIndex, reason: "no track (no selection)" });
          continue;
        }
        const track = song.tracks[trackIndex];
        if (!track) {
          skipped.push({ sceneIndex: clipInput.sceneIndex, reason: `track ${trackIndex} out of range` });
          continue;
        }
        if (!(track instanceof ableton.MidiTrack)) {
          skipped.push({ sceneIndex: clipInput.sceneIndex, reason: "not a MIDI track" });
          continue;
        }
        const slot = track.clipSlots[clipInput.sceneIndex];
        if (!slot) {
          skipped.push({ sceneIndex: clipInput.sceneIndex, reason: `scene ${clipInput.sceneIndex} out of range` });
          continue;
        }
        if (slot.clip != null) {
          skipped.push({ sceneIndex: clipInput.sceneIndex, reason: "slot occupied" });
          continue;
        }
        plans.push({
          slot,
          lengthBeats: clipInput.lengthBeats,
          notes: validateNotes(clipInput.notes) as ableton.NoteDescription[],
          sceneIndex: clipInput.sceneIndex,
        });
      }

      const created: number[] = [];
      if (plans.length > 0) {
        await context.withinTransaction(() =>
          Promise.all(
            plans.map(async (p) => {
              const clip = await p.slot.createMidiClip(p.lengthBeats);
              clip.notes = p.notes;
              created.push(p.sceneIndex);
            }),
          ),
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ created: created.length, createdScenes: created, skipped }),
          },
        ],
      };
    }),
  );
}
