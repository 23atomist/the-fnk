import { describe, it, expect } from "vitest";
import { captureClipSlot } from "../src/selection/capture.js";

describe("captureClipSlot", () => {
  it("reports hasClip=false for an empty slot", () => {
    expect(captureClipSlot({ clip: null })).toEqual({ kind: "clipSlot", hasClip: false });
  });
  it("reports hasClip=true for an occupied slot", () => {
    expect(captureClipSlot({ clip: { name: "Loop" } })).toEqual({ kind: "clipSlot", hasClip: true });
  });
});
