/** Minimal structural types for the live Ableton context we depend on in M0.
 *  Kept structural so tests can supply plain-object mocks. */
export interface LiveTrack {
  readonly name: string;
}

export interface LiveScene {
  readonly name: string;
}

export interface LiveSong {
  readonly tempo: number;
  readonly tracks: ReadonlyArray<LiveTrack>;
  readonly returnTracks: ReadonlyArray<LiveTrack>;
  readonly scenes: ReadonlyArray<LiveScene>;
  readonly rootNote: number;
  readonly scaleName: string;
}

export interface LiveApplication {
  readonly song: LiveSong;
}

/** The subset of ableton.ExtensionContext M0 uses. */
export interface LiveContext {
  readonly application: LiveApplication;
}
