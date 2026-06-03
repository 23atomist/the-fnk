import type { SelectionContext } from "./types.js";

/** Minimal structural view of a ClipSlot — just enough for AC-M0. */
export interface ClipSlotLike {
  readonly clip: unknown | null;
}

/** Snapshot a resolved clip slot into a plain SelectionContext. */
export function captureClipSlot(slot: ClipSlotLike): SelectionContext {
  return { kind: "clipSlot", hasClip: slot.clip != null };
}
