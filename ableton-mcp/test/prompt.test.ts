import { describe, it, expect } from "vitest";
import { composePrompt } from "../src/agent/prompt.js";

describe("composePrompt", () => {
  it("embeds the instruction and selection and names the generative tools", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: false }, "build me 4 two-step beats");
    expect(p).toContain("build me 4 two-step beats");
    expect(p).toContain("hasClip=false");
    expect(p).toContain("create_midi_clips");
    expect(p).toContain("ask_user");
    expect(p).toContain("get_selection");
  });
  it("instructs asking only when genuinely ambiguous", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: true }, "");
    expect(p.toLowerCase()).toContain("ambiguous");
    expect(p.length).toBeGreaterThan(40);
  });
  it("teaches relative placement underneath the selected cell", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: false }, "drums underneath");
    expect(p).toContain("sceneOffset");
    expect(p.toLowerCase()).toContain("underneath");
  });
  it("includes the drum velocity and melody guidance", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: false }, "make a beat");
    expect(p.toLowerCase()).toContain("velocity");
    expect(p.toLowerCase()).toContain("ghost note");
    expect(p).toContain("get_song_overview");
  });
});
