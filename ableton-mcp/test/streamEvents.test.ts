import { describe, it, expect } from "vitest";
import { parseStreamLine, stepMessage, shortToolName } from "../src/agent/streamEvents.js";

describe("shortToolName", () => {
  it("strips the mcp server prefix Claude prepends", () => {
    expect(shortToolName("mcp__ableton__create_midi_clips")).toBe("create_midi_clips");
    expect(shortToolName("bare_tool")).toBe("bare_tool");
  });
});

describe("parseStreamLine", () => {
  it("returns null for blank lines and non-JSON noise", () => {
    expect(parseStreamLine("")).toBeNull();
    expect(parseStreamLine("   ")).toBeNull();
    expect(parseStreamLine("not json")).toBeNull();
  });

  it("ignores hook/system noise but recognizes the init event", () => {
    expect(parseStreamLine(JSON.stringify({ type: "system", subtype: "hook_started" }))).toBeNull();
    expect(parseStreamLine(JSON.stringify({ type: "system", subtype: "init" }))).toEqual({ kind: "init" });
  });

  it("extracts a tool call from an assistant event (prefix stripped)", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", name: "mcp__ableton__create_midi_clips", input: {} }] },
    });
    expect(parseStreamLine(line)).toEqual({ kind: "tool", name: "create_midi_clips" });
  });

  it("reports a text-only assistant event as a text step", () => {
    const line = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } });
    expect(parseStreamLine(line)).toEqual({ kind: "text" });
  });

  it("prefers a tool_use over text when both are present", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "thinking" }, { type: "tool_use", name: "mcp__ableton__get_selection" }] },
    });
    expect(parseStreamLine(line)).toEqual({ kind: "tool", name: "get_selection" });
  });

  it("parses the final result event into a ClaudeResult", () => {
    const line = JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "Placed 1 clip.", num_turns: 4, total_cost_usd: 0.2 });
    const step = parseStreamLine(line);
    expect(step?.kind).toBe("result");
    if (step?.kind === "result") {
      expect(step.result.isError).toBe(false);
      expect(step.result.resultText).toBe("Placed 1 clip.");
      expect(step.result.numTurns).toBe(4);
    }
  });
});

describe("stepMessage", () => {
  it("maps known tools to friendly text", () => {
    expect(stepMessage({ kind: "tool", name: "get_selection" })).toBe("Reading your selection…");
    expect(stepMessage({ kind: "tool", name: "get_song_overview" })).toBe("Checking key & tempo…");
    expect(stepMessage({ kind: "tool", name: "create_midi_clips" })).toBe("Placing clips…");
    expect(stepMessage({ kind: "tool", name: "ask_user" })).toBe("Waiting for your answer…");
  });
  it("falls back to a generic message for unknown tools", () => {
    expect(stepMessage({ kind: "tool", name: "frobnicate" })).toBe("Running frobnicate…");
  });
  it("covers init, text and result steps", () => {
    expect(stepMessage({ kind: "init" })).toBe("Starting…");
    expect(stepMessage({ kind: "text" })).toBe("Composing…");
    expect(stepMessage({ kind: "result", result: { isError: false, resultText: "", costUsd: null, numTurns: null } })).toBe("Done");
  });
});
