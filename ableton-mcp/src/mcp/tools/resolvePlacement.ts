/** Where a clip should land, in terms the producer's selection can anchor. */
export interface ClipPlacement {
  /** Absolute track index. Wins over trackOffset when present. */
  trackIndex?: number;
  /** Absolute scene index. Wins over sceneOffset when present. */
  sceneIndex?: number;
  /** Track index relative to the selected track (e.g. 1 = next track to the right). */
  trackOffset?: number;
  /** Scene index relative to the selected scene (e.g. 1 = the row underneath). */
  sceneOffset?: number;
}

/** The cell the producer right-clicked, used as the anchor for relative placement. */
export interface SelectionAnchor {
  trackIndex: number;
  sceneIndex: number;
}

export type PlacementResult =
  | { ok: true; trackIndex: number; sceneIndex: number }
  | { ok: false; trackIndex: number | null; sceneIndex: number | null; reason: string };

/**
 * Resolve a clip's target (trackIndex, sceneIndex) from absolute indices and/or
 * offsets relative to the selected cell. Absolute indices always win over offsets.
 * Offsets (and the implicit "same cell" default) require a selection to anchor against.
 */
export function resolvePlacement(
  placement: ClipPlacement,
  selection: SelectionAnchor | null,
): PlacementResult {
  const trackIndex =
    placement.trackIndex ??
    (selection != null ? selection.trackIndex + (placement.trackOffset ?? 0) : null);
  const sceneIndex =
    placement.sceneIndex ??
    (selection != null ? selection.sceneIndex + (placement.sceneOffset ?? 0) : null);

  if (trackIndex == null) {
    return { ok: false, trackIndex: null, sceneIndex, reason: "no track (no selection)" };
  }
  if (sceneIndex == null) {
    return { ok: false, trackIndex, sceneIndex: null, reason: "no scene (no selection)" };
  }
  return { ok: true, trackIndex, sceneIndex };
}
