import { describe, it, expect } from "vitest";
import { resolveSlotPosition, type SongLike } from "../src/selection/resolveSlot.js";

function songWith(): { song: SongLike; targetSlot: object } {
  const target = { id: "t2s1" };
  const song: SongLike = {
    tracks: [
      { clipSlots: [{ id: "t0s0" }, { id: "t0s1" }] },
      { clipSlots: [{ id: "t1s0" }, { id: "t1s1" }] },
      { clipSlots: [{ id: "t2s0" }, target] },
    ],
  };
  return { song, targetSlot: target };
}

describe("resolveSlotPosition", () => {
  it("finds the track and scene index of a slot by identity", () => {
    const { song, targetSlot } = songWith();
    expect(resolveSlotPosition(song, targetSlot)).toEqual({ trackIndex: 2, sceneIndex: 1 });
  });
  it("returns null when the slot is not found", () => {
    const { song } = songWith();
    expect(resolveSlotPosition(song, { id: "nope" })).toBeNull();
  });
});
