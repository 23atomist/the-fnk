import { parseClaudeResult, type ClaudeResult } from "./resultParser.js";

/** A meaningful step distilled from one `--output-format stream-json` line. */
export type StreamStep =
  | { kind: "init" }
  | { kind: "tool"; name: string }
  | { kind: "text" }
  | { kind: "result"; result: ClaudeResult };

/** Friendly progress text per tool (short name, prefix already stripped). */
const FRIENDLY_TOOL: Record<string, string> = {
  get_selection: "Reading your selection…",
  get_song_overview: "Checking key & tempo…",
  ask_user: "Waiting for your answer…",
  create_midi_clips: "Placing clips…",
};

/** Strip the `mcp__<server>__` prefix Claude prepends to MCP tool names. */
export function shortToolName(name: string): string {
  const i = name.lastIndexOf("__");
  return i >= 0 ? name.slice(i + 2) : name;
}

interface AssistantBlock {
  type?: string;
  name?: string;
}

/** Parse one NDJSON line from the stream into a step, or null for blanks/noise/unknowns. */
export function parseStreamLine(line: string): StreamStep | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (obj.type === "system") return obj.subtype === "init" ? { kind: "init" } : null;
  if (obj.type === "result") return { kind: "result", result: parseClaudeResult(trimmed) };
  if (obj.type === "assistant") {
    const content = (obj.message as { content?: AssistantBlock[] } | undefined)?.content;
    if (!Array.isArray(content)) return null;
    const tool = content.find((b) => b.type === "tool_use" && typeof b.name === "string");
    if (tool?.name != null) return { kind: "tool", name: shortToolName(tool.name) };
    if (content.some((b) => b.type === "text")) return { kind: "text" };
  }
  return null;
}

/** Human-friendly progress text for a step. */
export function stepMessage(step: StreamStep): string {
  switch (step.kind) {
    case "init":
      return "Starting…";
    case "tool":
      return FRIENDLY_TOOL[step.name] ?? `Running ${step.name}…`;
    case "text":
      return "Composing…";
    case "result":
      return step.result.isError ? "Finishing…" : "Done";
  }
}
