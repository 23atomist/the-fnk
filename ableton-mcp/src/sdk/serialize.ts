import type { LiveContext } from "./types.js";

export interface SongOverview {
  tempo: number;
  trackCount: number;
  trackNames: string[];
  returnTrackNames: string[];
  sceneCount: number;
  sceneNames: string[];
  rootNote: number;
  scaleName: string;
}

/** Read the live song into an immutable plain-object snapshot (no SDK handles leak out). */
export function serializeSongOverview(context: LiveContext): SongOverview {
  const song = context.application.song;
  return {
    tempo: song.tempo,
    trackCount: song.tracks.length,
    trackNames: song.tracks.map((t) => t.name),
    returnTrackNames: song.returnTracks.map((t) => t.name),
    sceneCount: song.scenes.length,
    sceneNames: song.scenes.map((s) => s.name),
    rootNote: song.rootNote,
    scaleName: song.scaleName,
  };
}
