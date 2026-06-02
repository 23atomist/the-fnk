import { describe, it, expect } from "vitest";
import { serializeSongOverview } from "../src/sdk/serialize.js";
import type { LiveContext } from "../src/sdk/types.js";

function fakeContext(): LiveContext {
  return {
    application: {
      song: {
        tempo: 120,
        tracks: [{ name: "Drums" }, { name: "Bass" }],
        returnTracks: [{ name: "A-Reverb" }],
        scenes: [{ name: "Intro" }, { name: "Verse" }],
        rootNote: 0,
        scaleName: "Major",
      },
    },
  };
}

describe("serializeSongOverview", () => {
  it("produces a plain JSON snapshot of the song", () => {
    const snap = serializeSongOverview(fakeContext());
    expect(snap).toEqual({
      tempo: 120,
      trackCount: 2,
      trackNames: ["Drums", "Bass"],
      returnTrackNames: ["A-Reverb"],
      sceneCount: 2,
      sceneNames: ["Intro", "Verse"],
      rootNote: 0,
      scaleName: "Major",
    });
  });
});
