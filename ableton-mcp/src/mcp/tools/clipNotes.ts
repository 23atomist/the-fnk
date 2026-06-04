import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ableton from "@ableton-extensions/sdk";
import { getActiveSelection } from "../../selection/activeSelection.js";
import { withSafeHandler, type ToolResult } from "../../core/errors.js";

/** A note as surfaced to Claude — the musically-relevant fields of NoteDescription. */
export interface NoteOut {
  pitch: number;
  startTime: number;
  duration: number;
  velocity?: number;
}

/** Minimal read view of a MIDI clip — just what the serializer needs (host-free for tests). */
export interface MidiClipLike {
  readonly name: string;
  readonly loopStart: number;
  readonly loopEnd: number;
  readonly looping: boolean;
  readonly notes: ReadonlyArray<NoteOut>;
}

export type ClipNotesResult =
  | { hasClip: false }
  | { hasClip: true; isMidi: false }
  | { hasClip: true; isMidi: true; name: string; lengthBeats: number; looping: boolean; notes: NoteOut[] };

/**
 * Discriminated view of a clip slot, built by the handler from the live SDK
 * (the `instanceof MidiClip` decision lives there) so this serializer stays host-free.
 */
export type ClipSlotView =
  | { hasClip: false }
  | { hasClip: true; isMidi: false }
  | { hasClip: true; isMidi: true; clip: MidiClipLike };

/** Pure: shape a clip slot into the tool's JSON result. */
export function serializeClipSlot(view: ClipSlotView): ClipNotesResult {
  if (!view.hasClip) return { hasClip: false };
  if (!view.isMidi) return { hasClip: true, isMidi: false };
  const { clip } = view;
  return {
    hasClip: true,
    isMidi: true,
    name: clip.name,
    lengthBeats: clip.loopEnd - clip.loopStart,
    looping: clip.looping,
    notes: clip.notes.map((n) => ({
      pitch: n.pitch,
      startTime: n.startTime,
      duration: n.duration,
      ...(n.velocity != null ? { velocity: n.velocity } : {}),
    })),
  };
}

export type ReadTarget =
  | { ok: true; trackIndex: number; sceneIndex: number }
  | { ok: false; reason: string };

/** Pure: resolve which cell to read — explicit indices win, else default to the selection. */
export function resolveReadTarget(
  args: { trackIndex?: number; sceneIndex?: number },
  selection: { trackIndex: number; sceneIndex: number } | null,
): ReadTarget {
  const trackIndex = args.trackIndex ?? selection?.trackIndex ?? null;
  const sceneIndex = args.sceneIndex ?? selection?.sceneIndex ?? null;
  if (trackIndex == null) return { ok: false, reason: "no track (no selection)" };
  if (sceneIndex == null) return { ok: false, reason: "no scene (no selection)" };
  return { ok: true, trackIndex, sceneIndex };
}

/** Exported for unit testing the schema. */
export const ClipNotesInputShape = {
  trackIndex: z.number().optional(),
  sceneIndex: z.number().optional(),
};
type ClipNotesArgs = z.infer<ReturnType<typeof z.object<typeof ClipNotesInputShape>>>;

export function registerClipNotesTool(
  server: McpServer,
  context: ableton.ExtensionContext<"1.0.0">,
): void {
  server.registerTool(
    "get_clip_notes",
    {
      title: "Get clip notes",
      description:
        "Reads the MIDI notes of a Session cell so you can derive new material from existing content. " +
        "Defaults to the selected cell; pass trackIndex/sceneIndex to read another cell (e.g. drums on " +
        "another track). Returns { hasClip:false } for an empty slot, { hasClip:true, isMidi:false } for " +
        "an audio clip, or { hasClip:true, isMidi:true, name, lengthBeats, looping, " +
        "notes:[{pitch,startTime,duration,velocity}] } for a MIDI clip. Times are in beats (0 = clip start). " +
        "Read-only — never modifies the set.",
      inputSchema: ClipNotesInputShape,
    },
    withSafeHandler("get_clip_notes", async (args: ClipNotesArgs) => {
      const reply = (o: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(o) }] });
      const sel = getActiveSelection();
      const target = resolveReadTarget(args, sel);
      if (!target.ok) return reply({ error: target.reason });
      const song = context.application.song;
      const track = song.tracks[target.trackIndex];
      if (!track) return reply({ error: `track ${target.trackIndex} out of range` });
      const slot = track.clipSlots[target.sceneIndex];
      if (!slot) return reply({ error: `scene ${target.sceneIndex} out of range` });
      const clip = slot.clip;
      const view: ClipSlotView =
        clip == null
          ? { hasClip: false }
          : clip instanceof ableton.MidiClip
            ? { hasClip: true, isMidi: true, clip: clip as unknown as MidiClipLike }
            : { hasClip: true, isMidi: false };
      return reply(serializeClipSlot(view));
    }),
  );
}
