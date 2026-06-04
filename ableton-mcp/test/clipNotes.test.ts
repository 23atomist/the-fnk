import { describe, it, expect } from "vitest";
import { z } from "zod";
import { resolveReadTarget, serializeClipSlot, ClipNotesInputShape, type MidiClipLike } from "../src/mcp/tools/clipNotes.js";

describe("resolveReadTarget", () => {
  it("defaults to the active selection's cell when no indices given", () => {
    expect(resolveReadTarget({}, { trackIndex: 3, sceneIndex: 2 })).toEqual({
      ok: true, trackIndex: 3, sceneIndex: 2,
    });
  });
  it("lets explicit indices override the selection", () => {
    expect(resolveReadTarget({ trackIndex: 5 }, { trackIndex: 3, sceneIndex: 2 })).toEqual({
      ok: true, trackIndex: 5, sceneIndex: 2,
    });
  });
  it("overrides only the sceneIndex when just sceneIndex is given", () => {
    expect(resolveReadTarget({ sceneIndex: 5 }, { trackIndex: 3, sceneIndex: 2 })).toEqual({
      ok: true, trackIndex: 3, sceneIndex: 5,
    });
  });
  it("fails with no track when there is no selection and no trackIndex", () => {
    expect(resolveReadTarget({ sceneIndex: 1 }, null)).toEqual({
      ok: false, reason: "no track (no selection)",
    });
  });
  it("fails with no scene when track is given but scene cannot resolve", () => {
    expect(resolveReadTarget({ trackIndex: 1 }, null)).toEqual({
      ok: false, reason: "no scene (no selection)",
    });
  });
});

describe("serializeClipSlot", () => {
  const clip: MidiClipLike = {
    name: "Melody",
    loopStart: 0,
    loopEnd: 4,
    looping: true,
    notes: [
      { pitch: 60, startTime: 0, duration: 1, velocity: 100 },
      { pitch: 62, startTime: 1, duration: 0.5 }, // velocity omitted
    ],
  };
  it("reports an empty slot", () => {
    expect(serializeClipSlot({ hasClip: false })).toEqual({ hasClip: false });
  });
  it("reports an audio clip as non-MIDI", () => {
    expect(serializeClipSlot({ hasClip: true, isMidi: false })).toEqual({ hasClip: true, isMidi: false });
  });
  it("maps a MIDI clip to the result shape with lengthBeats = loopEnd - loopStart", () => {
    expect(serializeClipSlot({ hasClip: true, isMidi: true, clip })).toEqual({
      hasClip: true, isMidi: true, name: "Melody", lengthBeats: 4, looping: true,
      notes: [
        { pitch: 60, startTime: 0, duration: 1, velocity: 100 },
        { pitch: 62, startTime: 1, duration: 0.5 },
      ],
    });
  });
  it("omits velocity when the source note has none", () => {
    const out = serializeClipSlot({ hasClip: true, isMidi: true, clip });
    if (out.hasClip && out.isMidi) {
      expect(out.notes).toHaveLength(2);
      expect("velocity" in out.notes[1]).toBe(false);
    }
  });
});

describe("get_clip_notes input schema", () => {
  const schema = z.object(ClipNotesInputShape);
  it("accepts empty input (defaults to selection)", () => {
    expect(schema.parse({})).toEqual({});
  });
  it("accepts explicit trackIndex/sceneIndex", () => {
    expect(schema.parse({ trackIndex: 2, sceneIndex: 5 })).toEqual({ trackIndex: 2, sceneIndex: 5 });
  });
  it("rejects a non-numeric trackIndex", () => {
    expect(() => schema.parse({ trackIndex: "x" })).toThrow();
  });
});
