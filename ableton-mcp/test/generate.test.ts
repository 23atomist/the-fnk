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
  it("rejects a clip missing sceneIndex", () => {
    expect(() => schema.parse({ clips: [{ lengthBeats: 4, notes: [] }] })).toThrow();
  });
});
