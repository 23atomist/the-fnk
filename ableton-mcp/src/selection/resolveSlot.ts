/** Minimal structural view so this is unit-testable without the real SDK. */
export interface SongLike {
  tracks: ReadonlyArray<{ clipSlots: ReadonlyArray<object> }>;
}

/** Find the {trackIndex, sceneIndex} of `slot` by reference identity, or null. */
export function resolveSlotPosition(song: SongLike, slot: object): { trackIndex: number; sceneIndex: number } | null {
  for (let trackIndex = 0; trackIndex < song.tracks.length; trackIndex++) {
    const slots = song.tracks[trackIndex].clipSlots;
    for (let sceneIndex = 0; sceneIndex < slots.length; sceneIndex++) {
      if (slots[sceneIndex] === slot) return { trackIndex, sceneIndex };
    }
  }
  return null;
}
