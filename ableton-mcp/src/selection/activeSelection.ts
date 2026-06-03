export interface ActiveSelection {
  trackIndex: number;
  trackName: string;
  isMidiTrack: boolean;
  sceneIndex: number;
  hasClip: boolean;
  totalTracks: number;
  totalScenes: number;
}

let current: ActiveSelection | null = null;

/** Set (or clear with null) the selection the next spawned agent run acts on. */
export function setActiveSelection(selection: ActiveSelection | null): void {
  current = selection;
}

/** Read the active selection (null if none). */
export function getActiveSelection(): ActiveSelection | null {
  return current;
}
