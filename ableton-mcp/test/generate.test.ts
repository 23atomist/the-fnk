import { describe, it, expect } from "vitest";
import { ClipsInputShape } from "../src/mcp/tools/generate.js";
import { z } from "zod";

describe("create_midi_clips input schema", () => {
  const schema = z.object(ClipsInputShape);
  it("accepts a well-formed batch", () => {
    const parsed = schema.parse({
      clips: [{ sceneIndex: 0, lengthBeats: 4, notes: [{ pitch: 36, startTime: 0, duration: 0.5, velocity: 100 }] }],
    });
    expect(parsed.clips[0].sceneIndex).toBe(0);
  });
  it("accepts a clip with no sceneIndex (defaults to the selected scene)", () => {
    const parsed = schema.parse({ clips: [{ lengthBeats: 4, notes: [] }] });
    expect(parsed.clips[0].sceneIndex).toBeUndefined();
  });
  it("accepts relative placement via sceneOffset", () => {
    const parsed = schema.parse({ clips: [{ sceneOffset: 1, lengthBeats: 4, notes: [] }] });
    expect(parsed.clips[0].sceneOffset).toBe(1);
  });
  it("rejects a clip missing lengthBeats", () => {
    expect(() => schema.parse({ clips: [{ sceneIndex: 0, notes: [] }] })).toThrow();
  });
});
