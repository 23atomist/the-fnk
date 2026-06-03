import type { SelectionContext } from "../selection/types.js";

/** Build the headless-claude prompt from the captured selection + the producer's instruction. */
export function composePrompt(selection: SelectionContext, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    "You are a music-production assistant working INSIDE Ableton Live for a producer.",
    "Available MCP tools: get_song_overview, get_selection, ask_user, create_midi_clips.",
    `The producer right-clicked a Session clip slot (hasClip=${selection.hasClip}) and asked:`,
    `"${trimmed}"`,
    "Workflow:",
    "1. Call get_selection to learn the track/scene and whether it's a MIDI track.",
    "2. If — and only if — the request is genuinely ambiguous about count or length, call ask_user with ONE short question. Otherwise pick sensible defaults (e.g. 1 clip, 1 bar = 4 beats).",
    "3. Generate the MIDI (drums use GM pitches: kick 36, snare 38, closed-hat 42, open-hat 46; melodies/bass use pitched notes in a fitting key). Times are in beats, 0 = clip start.",
    "4. Place everything in ONE create_midi_clips call. Infer column (same track, consecutive scenes from the selected one) vs row (consecutive tracks, same scene) from the wording.",
    "Be efficient: do not narrate your reasoning. End with a one-sentence summary of what you placed.",
  ].join("\n");
}
