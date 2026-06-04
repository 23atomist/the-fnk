import type { SelectionContext } from "../selection/types.js";
import { MUSICAL_GUIDANCE } from "./musicGuidance.js";

/** Build the headless-claude prompt from the captured selection + the producer's instruction. */
export function composePrompt(selection: SelectionContext, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    "You are a music-production assistant working INSIDE Ableton Live for a producer.",
    "Available MCP tools: get_song_overview, get_selection, get_clip_notes, ask_user, create_midi_clips.",
    `The producer right-clicked a Session clip slot (hasClip=${selection.hasClip}) and asked:`,
    `"${trimmed}"`,
    "",
    "Workflow:",
    "1. Call get_selection to learn the selected track/scene and whether it's a MIDI track. For pitched material (melody/bass/chords) also call get_song_overview to get the key/scale and tempo.",
    "2. If the producer references existing content (e.g. \"from this melody\", \"based on this\", \"make a bass for this\"), call get_clip_notes to read the source clip's notes BEFORE generating, and derive the new part to fit it (see DERIVING A PART below). Read another cell by passing trackIndex/sceneIndex.",
    "3. If — and only if — the request is genuinely ambiguous about count or length, call ask_user with ONE short question. Otherwise pick sensible defaults (e.g. 1 clip, 1 bar = 4 beats).",
    "4. Generate the MIDI per the craft guidance below. Times are in beats, 0 = clip start.",
    "5. Place everything in ONE create_midi_clips call. Placement is relative to the selected cell by default: use sceneOffset for column moves (sceneOffset:1 = the row directly UNDERNEATH the selection, the most common request; 0 = the selected cell itself) and trackOffset for row moves (trackOffset:1 = the next track). For a derived part destined for a NAMED track (e.g. a bass track), resolve that track from get_song_overview and use its absolute trackIndex on the same sceneIndex. Use absolute trackIndex/sceneIndex when the producer names a specific cell. Infer column vs row from the wording.",
    "",
    MUSICAL_GUIDANCE,
    "",
    "Be efficient: do not narrate your reasoning. End with a one-sentence summary of what you placed.",
  ].join("\n");
}
