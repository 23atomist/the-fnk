export interface MidiNote {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Validate/clamp raw note objects into safe MidiNotes. Invalid notes are dropped. */
export function validateNotes(raw: unknown[]): MidiNote[] {
  const out: MidiNote[] = [];
  for (const r of raw) {
    const o = r as Record<string, unknown>;
    if (!isNum(o.pitch) || !isNum(o.startTime) || !isNum(o.duration)) continue;
    if (o.startTime < 0 || o.duration <= 0) continue;
    const velocity = isNum(o.velocity) ? clamp(Math.round(o.velocity), 0, 127) : 100;
    out.push({
      pitch: clamp(Math.round(o.pitch), 0, 127),
      startTime: o.startTime,
      duration: o.duration,
      velocity,
    });
  }
  return out;
}
