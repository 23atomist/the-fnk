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
