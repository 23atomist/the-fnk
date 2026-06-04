# Derive a New Clip from an Existing One (get_clip_notes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `get_clip_notes` MCP tool so Claude can read an existing MIDI clip's notes and generate a derived part (e.g. a bass from a melody) into another empty cell.

**Architecture:** One new tool file (`src/mcp/tools/clipNotes.ts`) with two pure, unit-tested functions (`resolveReadTarget`, `serializeMidiClip`) plus a thin `registerClipNotesTool` handler that reads `slot.clip` via the SDK. Destination selection and the derive workflow are prompt/guidance changes only — `create_midi_clips` (AC-M1) already writes the result. Mirrors the existing `selectionTool.ts` (pure serializer + register fn) and `generate.ts` (schema export + `withSafeHandler`) patterns.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), `@ableton-extensions/sdk` 1.0.0-beta.0, Zod, Vitest, esbuild.

**Spec:** `docs/superpowers/specs/2026-06-03-derive-clip-notes-design.md`

---

## File Structure

- **Create** `src/mcp/tools/clipNotes.ts` — types, `serializeMidiClip` (pure), `resolveReadTarget` (pure), `ClipNotesInputShape`, `registerClipNotesTool`.
- **Create** `test/clipNotes.test.ts` — unit tests for the two pure functions + the input schema.
- **Modify** `src/mcp/server.ts` — import and call `registerClipNotesTool`.
- **Modify** `src/agent/prompt.ts` — add `get_clip_notes` to the tool list + a derive-from-source workflow line.
- **Modify** `src/agent/musicGuidance.ts` — add `DERIVATION_GUIDANCE` and include it in `MUSICAL_GUIDANCE`.

Conventions to follow (verified in repo): import sibling modules with the `.js` extension; handlers wrapped in `withSafeHandler`; tool results are `{ content: [{ type: "text", text: JSON.stringify(...) }] }`; tests import from `../src/...js` and test **pure functions only** (never the live handler).

---

## Task 1: Pure functions — `resolveReadTarget` + `serializeMidiClip`

**Files:**
- Create: `src/mcp/tools/clipNotes.ts`
- Test: `test/clipNotes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/clipNotes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveReadTarget, serializeClipSlot, type MidiClipLike } from "../src/mcp/tools/clipNotes.js";

describe("resolveReadTarget", () => {
  it("defaults to the active selection's cell when no indices given", () => {
    expect(resolveReadTarget({}, { trackIndex: 3, sceneIndex: 2 })).toEqual({
      ok: true, trackIndex: 3, sceneIndex: 2,
    });
  });
  it("lets explicit indices override the selection", () => {
    expect(resolveReadTarget({ trackIndex: 5 }, { trackIndex: 3, sceneIndex: 2 })).toEqual({
      ok: true, trackIndex: 5, sceneIndex: 2,
    });
  });
  it("fails with no track when there is no selection and no trackIndex", () => {
    expect(resolveReadTarget({ sceneIndex: 1 }, null)).toEqual({
      ok: false, reason: "no track (no selection)",
    });
  });
  it("fails with no scene when track is given but scene cannot resolve", () => {
    expect(resolveReadTarget({ trackIndex: 1 }, null)).toEqual({
      ok: false, reason: "no scene (no selection)",
    });
  });
});

describe("serializeClipSlot", () => {
  const clip: MidiClipLike = {
    name: "Melody",
    loopStart: 0,
    loopEnd: 4,
    looping: true,
    notes: [
      { pitch: 60, startTime: 0, duration: 1, velocity: 100 },
      { pitch: 62, startTime: 1, duration: 0.5 }, // velocity omitted
    ],
  };
  it("reports an empty slot", () => {
    expect(serializeClipSlot({ hasClip: false })).toEqual({ hasClip: false });
  });
  it("reports an audio clip as non-MIDI", () => {
    expect(serializeClipSlot({ hasClip: true, isMidi: false })).toEqual({ hasClip: true, isMidi: false });
  });
  it("maps a MIDI clip to the result shape with lengthBeats = loopEnd - loopStart", () => {
    expect(serializeClipSlot({ hasClip: true, isMidi: true, clip })).toEqual({
      hasClip: true, isMidi: true, name: "Melody", lengthBeats: 4, looping: true,
      notes: [
        { pitch: 60, startTime: 0, duration: 1, velocity: 100 },
        { pitch: 62, startTime: 1, duration: 0.5 },
      ],
    });
  });
  it("omits velocity when the source note has none", () => {
    const out = serializeClipSlot({ hasClip: true, isMidi: true, clip });
    if (out.hasClip && out.isMidi) {
      expect("velocity" in out.notes[1]).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/clipNotes.test.ts`
Expected: FAIL — cannot resolve import `../src/mcp/tools/clipNotes.js` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/mcp/tools/clipNotes.ts`:

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ableton from "@ableton-extensions/sdk";
import { getActiveSelection } from "../../selection/activeSelection.js";
import { withSafeHandler, type ToolResult } from "../../core/errors.js";

/** A note as surfaced to Claude — the musically-relevant fields of NoteDescription. */
export interface NoteOut {
  pitch: number;
  startTime: number;
  duration: number;
  velocity?: number;
}

/** Minimal read view of a MIDI clip — just what the serializer needs (host-free for tests). */
export interface MidiClipLike {
  readonly name: string;
  readonly loopStart: number;
  readonly loopEnd: number;
  readonly looping: boolean;
  readonly notes: ReadonlyArray<NoteOut>;
}

export type ClipNotesResult =
  | { hasClip: false }
  | { hasClip: true; isMidi: false }
  | { hasClip: true; isMidi: true; name: string; lengthBeats: number; looping: boolean; notes: NoteOut[] };

/**
 * Discriminated view of a clip slot, built by the handler from the live SDK
 * (the `instanceof MidiClip` decision lives there) so this serializer stays host-free.
 */
export type ClipSlotView =
  | { hasClip: false }
  | { hasClip: true; isMidi: false }
  | { hasClip: true; isMidi: true; clip: MidiClipLike };

/** Pure: shape a clip slot into the tool's JSON result. */
export function serializeClipSlot(view: ClipSlotView): ClipNotesResult {
  if (!view.hasClip) return { hasClip: false };
  if (!view.isMidi) return { hasClip: true, isMidi: false };
  const { clip } = view;
  return {
    hasClip: true,
    isMidi: true,
    name: clip.name,
    lengthBeats: clip.loopEnd - clip.loopStart,
    looping: clip.looping,
    notes: clip.notes.map((n) => ({
      pitch: n.pitch,
      startTime: n.startTime,
      duration: n.duration,
      ...(n.velocity != null ? { velocity: n.velocity } : {}),
    })),
  };
}

export type ReadTarget =
  | { ok: true; trackIndex: number; sceneIndex: number }
  | { ok: false; reason: string };

/** Pure: resolve which cell to read — explicit indices win, else default to the selection. */
export function resolveReadTarget(
  args: { trackIndex?: number; sceneIndex?: number },
  selection: { trackIndex: number; sceneIndex: number } | null,
): ReadTarget {
  const trackIndex = args.trackIndex ?? selection?.trackIndex ?? null;
  const sceneIndex = args.sceneIndex ?? selection?.sceneIndex ?? null;
  if (trackIndex == null) return { ok: false, reason: "no track (no selection)" };
  if (sceneIndex == null) return { ok: false, reason: "no scene (no selection)" };
  return { ok: true, trackIndex, sceneIndex };
}

/** Exported for unit testing the schema. */
export const ClipNotesInputShape = {
  trackIndex: z.number().optional(),
  sceneIndex: z.number().optional(),
};
type ClipNotesArgs = z.infer<ReturnType<typeof z.object<typeof ClipNotesInputShape>>>;

export function registerClipNotesTool(
  server: McpServer,
  context: ableton.ExtensionContext<"1.0.0">,
): void {
  server.registerTool(
    "get_clip_notes",
    {
      title: "Get clip notes",
      description:
        "Reads the MIDI notes of a Session cell so you can derive new material from existing content. " +
        "Defaults to the selected cell; pass trackIndex/sceneIndex to read another cell (e.g. drums on " +
        "another track). Returns { hasClip:false } for an empty slot, { hasClip:true, isMidi:false } for " +
        "an audio clip, or { hasClip:true, isMidi:true, name, lengthBeats, looping, " +
        "notes:[{pitch,startTime,duration,velocity}] } for a MIDI clip. Times are in beats (0 = clip start). " +
        "Read-only — never modifies the set.",
      inputSchema: ClipNotesInputShape,
    },
    withSafeHandler("get_clip_notes", async (args: ClipNotesArgs) => {
      const reply = (o: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(o) }] });
      const sel = getActiveSelection();
      const target = resolveReadTarget(args, sel);
      if (!target.ok) return reply({ error: target.reason });
      const song = context.application.song;
      const track = song.tracks[target.trackIndex];
      if (!track) return reply({ error: `track ${target.trackIndex} out of range` });
      const slot = track.clipSlots[target.sceneIndex];
      if (!slot) return reply({ error: `scene ${target.sceneIndex} out of range` });
      const clip = slot.clip;
      const view: ClipSlotView =
        clip == null
          ? { hasClip: false }
          : clip instanceof ableton.MidiClip
            ? { hasClip: true, isMidi: true, clip: clip as unknown as MidiClipLike }
            : { hasClip: true, isMidi: false };
      return reply(serializeClipSlot(view));
    }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/clipNotes.test.ts`
Expected: PASS — all 8 tests green (4 `resolveReadTarget` + 4 `serializeClipSlot`).

- [ ] **Step 5: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/tools/clipNotes.ts test/clipNotes.test.ts
git commit -m "feat: get_clip_notes pure serializer + read-target resolver"
```

---

## Task 2: Register the tool + schema test

**Files:**
- Modify: `src/mcp/server.ts`
- Test: `test/clipNotes.test.ts` (append a schema describe block)

- [ ] **Step 1: Write the failing test**

Append to `test/clipNotes.test.ts`:

```typescript
import { ClipNotesInputShape } from "../src/mcp/tools/clipNotes.js";
import { z } from "zod";

describe("get_clip_notes input schema", () => {
  const schema = z.object(ClipNotesInputShape);
  it("accepts empty input (defaults to selection)", () => {
    expect(schema.parse({})).toEqual({});
  });
  it("accepts explicit trackIndex/sceneIndex", () => {
    expect(schema.parse({ trackIndex: 2, sceneIndex: 5 })).toEqual({ trackIndex: 2, sceneIndex: 5 });
  });
  it("rejects a non-numeric trackIndex", () => {
    expect(() => schema.parse({ trackIndex: "x" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (schema already exists from Task 1; this guards it)

Run: `npx vitest run test/clipNotes.test.ts`
Expected: PASS — the new schema block is green (3 more tests).

- [ ] **Step 3: Wire the tool into the server**

Modify `src/mcp/server.ts`. Add the import after the existing tool imports (after line 6):

```typescript
import { registerClipNotesTool } from "./tools/clipNotes.js";
```

And register it inside `buildMcpServer`, immediately after `registerSelectionTool(server);`:

```typescript
  registerClipNotesTool(server, context);
```

Resulting `buildMcpServer` body:

```typescript
  const server = new McpServer({ name: "ableton-mcp", version: "0.0.1" });
  registerSongTools(server, context);
  registerSelectionTool(server);
  registerClipNotesTool(server, context);
  registerAskUserTool(server, context);
  registerGenerateTool(server, context);
  return server;
```

- [ ] **Step 4: Type-check + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all test files pass.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/server.ts test/clipNotes.test.ts
git commit -m "feat: register get_clip_notes tool on the MCP server"
```

---

## Task 3: Derive workflow prompt + derivation guidance

**Files:**
- Modify: `src/agent/musicGuidance.ts`
- Modify: `src/agent/prompt.ts`
- Test: `test/derivePrompt.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `test/derivePrompt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { composePrompt } from "../src/agent/prompt.js";
import { MUSICAL_GUIDANCE } from "../src/agent/musicGuidance.js";

describe("derive-from-source prompt", () => {
  it("lists get_clip_notes among the available tools", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: true }, "make me a bass from this melody");
    expect(p).toContain("get_clip_notes");
  });
  it("tells the agent to read the source before deriving", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: true }, "make a bass from this");
    expect(p.toLowerCase()).toContain("get_clip_notes");
    expect(p.toLowerCase()).toMatch(/derive|based on|from this/);
  });
  it("includes derivation guidance in the musical brief", () => {
    expect(MUSICAL_GUIDANCE).toContain("DERIVING A PART");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/derivePrompt.test.ts`
Expected: FAIL — prompt does not contain `get_clip_notes`; `MUSICAL_GUIDANCE` lacks `DERIVING A PART`.

- [ ] **Step 3: Add derivation guidance**

In `src/agent/musicGuidance.ts`, add this constant immediately before the final `MUSICAL_GUIDANCE` export (after the `MELODY_GUIDANCE` block, around line 41):

```typescript
/** Deriving a new part from an existing clip (e.g. a bass from a melody). */
export const DERIVATION_GUIDANCE = [
  "DERIVING A PART FROM SOURCE MATERIAL — When the producer references existing content (\"from this melody\", \"based on this\", \"make a bass for this\"), first read the source clip with get_clip_notes, then build the new part to fit it.",
  "Match the source's clip length (lengthBeats) and its key/scale (from get_song_overview). Keep the new part in the same harmonic world — reuse the source's chord tones; don't introduce a clashing key.",
  "Deriving a BASS from a melody/chords: take the strong-beat / chord-root pitches of the source and play them an octave or two down (target register 28-48); simplify the rhythm toward downbeats and sustained roots, lock to the kick if drums exist, and leave space — the bass should be simpler than the source, not a copy.",
  "Deriving a COUNTER-MELODY or HARMONY: move mostly in contrary motion to the source, land chord tones (3rds/6ths above) on strong beats, and rest where the source is busy so the two parts interlock rather than collide.",
].join("\n");
```

Then change the final export (line 43) to include it:

```typescript
/** The full musical brief appended to the generation prompt. */
export const MUSICAL_GUIDANCE = [DRUM_GUIDANCE, "", MELODY_GUIDANCE, "", DERIVATION_GUIDANCE].join("\n");
```

- [ ] **Step 4: Update the prompt workflow**

In `src/agent/prompt.ts`, update the tools line (line 9) to include `get_clip_notes`:

```typescript
    "Available MCP tools: get_song_overview, get_selection, get_clip_notes, ask_user, create_midi_clips.",
```

Then insert a new workflow line between the current step 1 (line 14) and step 2 (line 15), so the steps read:

```typescript
    "1. Call get_selection to learn the selected track/scene and whether it's a MIDI track. For pitched material (melody/bass/chords) also call get_song_overview to get the key/scale and tempo.",
    "2. If the producer references existing content (e.g. \"from this melody\", \"based on this\", \"make a bass for this\"), call get_clip_notes to read the source clip's notes BEFORE generating, and derive the new part to fit it (see DERIVING A PART below). Read another cell by passing trackIndex/sceneIndex.",
    "3. If — and only if — the request is genuinely ambiguous about count or length, call ask_user with ONE short question. Otherwise pick sensible defaults (e.g. 1 clip, 1 bar = 4 beats).",
    "4. Generate the MIDI per the craft guidance below. Times are in beats, 0 = clip start.",
    "5. Place everything in ONE create_midi_clips call. Placement is relative to the selected cell by default: use sceneOffset for column moves (sceneOffset:1 = the row directly UNDERNEATH the selection, the most common request; 0 = the selected cell itself) and trackOffset for row moves (trackOffset:1 = the next track). For a derived part destined for a NAMED track (e.g. a bass track), resolve that track from get_song_overview and use its absolute trackIndex on the same sceneIndex. Use absolute trackIndex/sceneIndex when the producer names a specific cell. Infer column vs row from the wording.",
```

(This renumbers the old steps 2–4 to 3–5 and folds destination-by-name resolution into the placement step. Replace the existing lines 15–17 accordingly.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/derivePrompt.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 6: Type-check + full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; every test file passes.

- [ ] **Step 7: Commit**

```bash
git add src/agent/musicGuidance.ts src/agent/prompt.ts test/derivePrompt.test.ts
git commit -m "feat: derive-from-source workflow prompt + derivation guidance"
```

---

## Task 4: Build + live smoke test

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: `tsc --noEmit` passes, esbuild writes `dist/extension.js` with no errors.

- [ ] **Step 2: Restart the host against a running Live (avoid the registration race)**

With Ableton Live already running, run in your own terminal:

```bash
pkill -f ExtensionHostNodeModule; npm start
```

Watch for `[ableton-mcp] registered "Ask Claude…" on ClipSlot` and `MCP server listening`. (If Live is NOT already running, start it first, then `npm start` — registering against a still-booting Live drops the context menu. See `memory/ableton-mcp-host-constraints.md`.)

- [ ] **Step 3: Manual smoke test in Live**

In Session view, create a short MIDI melody clip on a track. Right-click it → "Ask Claude…" → type "make me a bass from this melody". Verify: Claude calls `get_clip_notes`, then `create_midi_clips` writes a bass clip into another cell as a single undo step, and the bass roughly follows the melody's roots an octave down.

- [ ] **Step 4: Final commit (if any build artifacts or notes changed)**

```bash
git status   # confirm clean or commit any intended changes
```

---

## Notes / deferred

- **Out of scope (AC-M3):** augment-in-place (overwriting an occupied slot to extend/humanize an existing clip).
- **Separate chore:** a `start`-script preflight that kills stale hosts and waits for Live to be ready before the host registers — would prevent the zombie-host and registration-race failure modes documented in `memory/ableton-mcp-host-constraints.md`. Not part of this feature.
