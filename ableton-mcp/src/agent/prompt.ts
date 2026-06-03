import type { SelectionContext } from "../selection/types.js";

/** Build the headless-claude prompt from the captured selection + the producer's instruction. */
export function composePrompt(selection: SelectionContext, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    "You are assisting a music producer inside Ableton Live.",
    "You have Ableton tools available via MCP (e.g. get_song_overview); use them as needed.",
    `The producer selected a Session clip slot (hasClip=${selection.hasClip}).`,
    `Their instruction: "${trimmed}".`,
    "Act on the selected slot using the tools. Then reply with a one-sentence summary of what you did.",
  ].join("\n");
}
