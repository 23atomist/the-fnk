import { describe, it, expect } from "vitest";
import { validateNotes } from "../src/agent/notes.js";

describe("validateNotes", () => {
  it("keeps valid notes and applies a default velocity", () => {
    const out = validateNotes([{ pitch: 36, startTime: 0, duration: 0.5 }]);
    expect(out).toEqual([{ pitch: 36, startTime: 0, duration: 0.5, velocity: 100 }]);
  });
  it("clamps pitch and velocity into 0..127 and keeps provided velocity", () => {
    const out = validateNotes([{ pitch: 200, startTime: 0, duration: 1, velocity: 999 }]);
    expect(out[0].pitch).toBe(127);
    expect(out[0].velocity).toBe(127);
  });
  it("drops notes with non-positive duration or negative startTime or non-numeric pitch", () => {
    const out = validateNotes([
      { pitch: 60, startTime: 0, duration: 0 },
      { pitch: 60, startTime: -1, duration: 1 },
      { pitch: "x", startTime: 0, duration: 1 },
      { pitch: 62, startTime: 1, duration: 1 },
    ] as unknown[]);
    expect(out).toEqual([{ pitch: 62, startTime: 1, duration: 1, velocity: 100 }]);
  });
});
