import { describe, it, expect } from "vitest";
import { serializeActiveSelection } from "../src/mcp/tools/selectionTool.js";
import { setActiveSelection } from "../src/selection/activeSelection.js";

describe("serializeActiveSelection", () => {
  it("reports no selection when none is active", () => {
    setActiveSelection(null);
    expect(serializeActiveSelection()).toEqual({ hasSelection: false });
  });
  it("returns the active selection fields when set", () => {
    setActiveSelection({ trackIndex: 6, trackName: "7-Serum 2", isMidiTrack: true, sceneIndex: 0, hasClip: false, totalTracks: 12, totalScenes: 9 });
    expect(serializeActiveSelection()).toEqual({
      hasSelection: true, trackIndex: 6, trackName: "7-Serum 2", isMidiTrack: true,
      sceneIndex: 0, hasClip: false, totalTracks: 12, totalScenes: 9,
    });
  });
});
