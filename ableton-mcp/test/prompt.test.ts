import { describe, it, expect } from "vitest";
import { composePrompt } from "../src/agent/prompt.js";

describe("composePrompt", () => {
  it("embeds the instruction and selection, and points at the ableton tools", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: false }, "make a 4-bar bassline");
    expect(p).toContain("make a 4-bar bassline");
    expect(p).toContain("clip slot");
    expect(p).toContain("hasClip=false");
    expect(p.toLowerCase()).toContain("ableton");
  });
  it("does not let an empty instruction produce an empty prompt", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: true }, "");
    expect(p.length).toBeGreaterThan(20);
  });
});
