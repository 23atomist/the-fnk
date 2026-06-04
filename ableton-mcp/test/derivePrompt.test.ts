import { describe, it, expect } from "vitest";
import { composePrompt } from "../src/agent/prompt.js";
import { MUSICAL_GUIDANCE } from "../src/agent/musicGuidance.js";

describe("derive-from-source prompt", () => {
  it("lists get_clip_notes among the available tools", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: true }, "make me a bass from this melody");
    expect(p).toContain("get_clip_notes");
  });
  it("tells the agent to read the source before deriving", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: true }, "make a bass from this");
    expect(p.toLowerCase()).toContain("get_clip_notes");
    expect(p.toLowerCase()).toMatch(/derive|based on|from this/);
  });
  it("includes derivation guidance in the musical brief", () => {
    expect(MUSICAL_GUIDANCE).toContain("DERIVING A PART");
  });
});

describe("tool-use mandate (anti-text-payload hardening)", () => {
  it("forbids printing clip JSON and mandates calling create_midi_clips", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: false }, "make 6 drum variations");
    expect(p).toContain("create_midi_clips");
    expect(p).toMatch(/NEVER write clip or note JSON/);
    expect(p.toLowerCase()).toContain("do not print the clip json");
  });
  it("caps the batch at 4 clips per call", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: false }, "make 6 drum variations");
    expect(p).toMatch(/at most 4 clips/i);
  });
});
