import { describe, it, expect, beforeEach } from "vitest";
import { setActiveSelection, getActiveSelection, type ActiveSelection } from "../src/selection/activeSelection.js";

const sample: ActiveSelection = {
  trackIndex: 6, trackName: "7-Serum 2", isMidiTrack: true,
  sceneIndex: 0, hasClip: false, totalTracks: 12, totalScenes: 9,
};

describe("activeSelection store", () => {
  beforeEach(() => setActiveSelection(null));
  it("returns null when nothing is set", () => {
    expect(getActiveSelection()).toBeNull();
  });
  it("round-trips the active selection", () => {
    setActiveSelection(sample);
    expect(getActiveSelection()).toEqual(sample);
  });
});
