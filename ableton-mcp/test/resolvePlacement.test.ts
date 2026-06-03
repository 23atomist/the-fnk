import { describe, it, expect } from "vitest";
import { resolvePlacement } from "../src/mcp/tools/resolvePlacement.js";

const sel = { trackIndex: 3, sceneIndex: 5 };

describe("resolvePlacement", () => {
  it("uses absolute indices when provided", () => {
    const r = resolvePlacement({ trackIndex: 1, sceneIndex: 2 }, sel);
    expect(r).toEqual({ ok: true, trackIndex: 1, sceneIndex: 2 });
  });

  it("places underneath the selected cell with sceneOffset 1", () => {
    const r = resolvePlacement({ sceneOffset: 1 }, sel);
    expect(r).toEqual({ ok: true, trackIndex: 3, sceneIndex: 6 });
  });

  it("defaults to the selected cell when nothing is specified", () => {
    const r = resolvePlacement({}, sel);
    expect(r).toEqual({ ok: true, trackIndex: 3, sceneIndex: 5 });
  });

  it("applies trackOffset for row placement on the next track", () => {
    const r = resolvePlacement({ trackOffset: 1 }, sel);
    expect(r).toEqual({ ok: true, trackIndex: 4, sceneIndex: 5 });
  });

  it("absolute index wins over an offset on the same axis", () => {
    const r = resolvePlacement({ sceneIndex: 0, sceneOffset: 9 }, sel);
    expect(r).toEqual({ ok: true, trackIndex: 3, sceneIndex: 0 });
  });

  it("fails when no track can be resolved (absolute scene, no selection)", () => {
    const r = resolvePlacement({ sceneIndex: 2 }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.sceneIndex).toBe(2);
      expect(r.reason).toContain("no track");
    }
  });

  it("fails when no scene can be resolved (absolute track, no selection)", () => {
    const r = resolvePlacement({ trackIndex: 1 }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.trackIndex).toBe(1);
      expect(r.reason).toContain("no scene");
    }
  });
});
