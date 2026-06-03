# "Ask Claude" AC-M1 — Generative MIDI Placement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-click a cell → "build me some dope 2-step beats" → Claude (asking "how many?" only if genuinely ambiguous) generates patterns and places them as MIDI clips across cells in one undo step.

**Architecture:** Adds three MCP tools to the existing in-extension server: `get_selection` (reads the active selection the context-menu handler stashes), `ask_user` (pops an Ableton modal mid-run and returns the typed answer), and `create_midi_clips` (zod-validated batch placement inside one `withinTransaction`). Pure logic (selection store, slot resolution, note validation, selection serialization, prompt) is unit-tested; the SDK placement, `ask_user` modal, and end-to-end flow are verified at live gates.

**Tech Stack:** TypeScript, `@ableton-extensions/sdk`, `@modelcontextprotocol/sdk` (1.29), `zod`, Vitest. Builds on AC-M0 (on `main`).

**Reference spec:** `docs/superpowers/specs/2026-06-02-ask-claude-feature-design.md` §9.
**Always prefix shell with:** `export PATH="/Users/thomasgallaway/.asdf/shims:$PATH"`. tsc must stay clean; no `any`. Commit signing is disabled locally (commits work).

---

## Verified SDK facts
- `Song.tracks: Track[]`, `Track.clipSlots: ClipSlot[]`, `ClipSlot.clip: Clip | null`, `ClipSlot.createMidiClip(length: number): Promise<MidiClip>`, `MidiClip.notes` get/set `NoteDescription[]`.
- `NoteDescription = { pitch, startTime, duration, velocity?, muted?, probability?, velocityDeviation?, releaseVelocity?, selected? }`.
- `MidiTrack extends Track` — detect MIDI track via `track instanceof ableton.MidiTrack`.
- `context.withinTransaction(fn)` — `fn` must be SYNC but may return `Promise.all([...])` to group async ops into one undo.
- `context.ui.showModalDialog(url, w, h): Promise<string>` (used by `ask_user`; reuse `toDataUrl` + a prompt HTML).
- `McpServer.registerTool(name, { title, description, inputSchema }, handler)` — `inputSchema` is a Zod raw shape (object of zod validators). The M0 tool used no input; confirm the raw-shape form compiles (Task 4 first use).

## File Structure (under `ableton-mcp/`)
| File | Responsibility |
|---|---|
| `src/selection/activeSelection.ts` | module store: `setActiveSelection`/`getActiveSelection`; `ActiveSelection` type |
| `src/selection/resolveSlot.ts` | `resolveSlotPosition(song, slot)` → `{trackIndex, sceneIndex}` by identity |
| `src/agent/notes.ts` | `validateNotes(raw)` → clamped `NoteDescription[]` |
| `src/mcp/tools/selectionTool.ts` | `registerSelectionTool` + `serializeActiveSelection` |
| `src/mcp/tools/askUser.ts` | `registerAskUserTool` (modal mid-run) |
| `src/mcp/tools/generate.ts` | `registerGenerateTool` (`create_midi_clips`) |
| `src/mcp/server.ts` (modify) | register the three new tools |
| `src/selection/askClaude.ts` (modify) | resolve + stash active selection before spawn |
| `src/agent/prompt.ts` (modify) | generative guidance |

---

## Task 1: Active-selection store

**Files:** Create `src/selection/activeSelection.ts`, `test/activeSelection.test.ts`

- [ ] **Step 1: Failing test** at `test/activeSelection.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setActiveSelection, getActiveSelection, type ActiveSelection } from "../src/selection/activeSelection.js";

const sample: ActiveSelection = {
  trackIndex: 6, trackName: "7-Serum 2", isMidiTrack: true,
  sceneIndex: 0, hasClip: false, totalTracks: 12, totalScenes: 9,
};

describe("activeSelection store", () => {
  beforeEach(() => setActiveSelection(null));
  it("returns null when nothing is set", () => {
    expect(getActiveSelection()).toBeNull();
  });
  it("round-trips the active selection", () => {
    setActiveSelection(sample);
    expect(getActiveSelection()).toEqual(sample);
  });
});
```

- [ ] **Step 2: Run, expect FAIL:** `cd /Volumes/ExtData2/coding/thefck/ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/activeSelection.test.ts`

- [ ] **Step 3: Implement** `src/selection/activeSelection.ts`:
```ts
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
```

- [ ] **Step 4: Run, expect PASS** (same command). Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit:**
```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/selection/activeSelection.ts ableton-mcp/test/activeSelection.test.ts
git commit -m "feat: active-selection store"
```

---

## Task 2: Slot position resolution

**Files:** Create `src/selection/resolveSlot.ts`, `test/resolveSlot.test.ts`

- [ ] **Step 1: Failing test** at `test/resolveSlot.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveSlotPosition, type SongLike } from "../src/selection/resolveSlot.js";

function songWith(): { song: SongLike; targetSlot: object } {
  const target = { id: "t2s1" };
  const song: SongLike = {
    tracks: [
      { clipSlots: [{ id: "t0s0" }, { id: "t0s1" }] },
      { clipSlots: [{ id: "t1s0" }, { id: "t1s1" }] },
      { clipSlots: [{ id: "t2s0" }, target] },
    ],
  };
  return { song, targetSlot: target };
}

describe("resolveSlotPosition", () => {
  it("finds the track and scene index of a slot by identity", () => {
    const { song, targetSlot } = songWith();
    expect(resolveSlotPosition(song, targetSlot)).toEqual({ trackIndex: 2, sceneIndex: 1 });
  });
  it("returns null when the slot is not found", () => {
    const { song } = songWith();
    expect(resolveSlotPosition(song, { id: "nope" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (same path).

- [ ] **Step 3: Implement** `src/selection/resolveSlot.ts`:
```ts
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
```

- [ ] **Step 4: Run, expect PASS.** Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit:**
```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/selection/resolveSlot.ts ableton-mcp/test/resolveSlot.test.ts
git commit -m "feat: resolve clip-slot position by identity"
```

---

## Task 3: Note validation

**Files:** Create `src/agent/notes.ts`, `test/notes.test.ts`

- [ ] **Step 1: Failing test** at `test/notes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateNotes } from "../src/agent/notes.js";

describe("validateNotes", () => {
  it("keeps valid notes and applies a default velocity", () => {
    const out = validateNotes([{ pitch: 36, startTime: 0, duration: 0.5 }]);
    expect(out).toEqual([{ pitch: 36, startTime: 0, duration: 0.5, velocity: 100 }]);
  });
  it("clamps pitch and velocity into 0..127 and keeps provided velocity", () => {
    const out = validateNotes([{ pitch: 200, startTime: 0, duration: 1, velocity: 999 }]);
    expect(out[0].pitch).toBe(127);
    expect(out[0].velocity).toBe(127);
  });
  it("drops notes with non-positive duration or negative startTime or non-numeric pitch", () => {
    const out = validateNotes([
      { pitch: 60, startTime: 0, duration: 0 },
      { pitch: 60, startTime: -1, duration: 1 },
      { pitch: "x", startTime: 0, duration: 1 },
      { pitch: 62, startTime: 1, duration: 1 },
    ] as unknown[]);
    expect(out).toEqual([{ pitch: 62, startTime: 1, duration: 1, velocity: 100 }]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/agent/notes.ts`:
```ts
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
```

- [ ] **Step 4: Run, expect PASS.** Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit:**
```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/agent/notes.ts ableton-mcp/test/notes.test.ts
git commit -m "feat: MIDI note validation/clamping"
```

---

## Task 4: `get_selection` tool

**Files:** Create `src/mcp/tools/selectionTool.ts`, `test/selectionTool.test.ts`

- [ ] **Step 1: Failing test** at `test/selectionTool.test.ts` (tests the pure serializer):
```ts
import { describe, it, expect } from "vitest";
import { serializeActiveSelection } from "../src/mcp/tools/selectionTool.js";
import { setActiveSelection } from "../src/selection/activeSelection.js";

describe("serializeActiveSelection", () => {
  it("reports no selection when none is active", () => {
    setActiveSelection(null);
    expect(serializeActiveSelection()).toEqual({ hasSelection: false });
  });
  it("returns the active selection fields when set", () => {
    setActiveSelection({ trackIndex: 6, trackName: "7-Serum 2", isMidiTrack: true, sceneIndex: 0, hasClip: false, totalTracks: 12, totalScenes: 9 });
    expect(serializeActiveSelection()).toEqual({
      hasSelection: true, trackIndex: 6, trackName: "7-Serum 2", isMidiTrack: true,
      sceneIndex: 0, hasClip: false, totalTracks: 12, totalScenes: 9,
    });
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/mcp/tools/selectionTool.ts`:
```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getActiveSelection } from "../../selection/activeSelection.js";
import { withSafeHandler } from "../../core/errors.js";

/** Pure: shape the active selection into the tool's JSON result. */
export function serializeActiveSelection(): Record<string, unknown> {
  const sel = getActiveSelection();
  if (sel === null) return { hasSelection: false };
  return { hasSelection: true, ...sel };
}

export function registerSelectionTool(server: McpServer): void {
  server.registerTool(
    "get_selection",
    {
      title: "Get current selection",
      description:
        "Returns the Session cell the producer right-clicked: trackIndex, trackName, isMidiTrack, sceneIndex, hasClip, totalTracks, totalScenes. Use it to decide where to place clips.",
    },
    withSafeHandler("get_selection", async () => {
      return { content: [{ type: "text", text: JSON.stringify(serializeActiveSelection(), null, 2) }] };
    }),
  );
}
```

- [ ] **Step 4: Run, expect PASS.** Then `npx tsc --noEmit` (clean). If `registerTool` with no `inputSchema` typechecks (it did for get_song_overview), this is fine.

- [ ] **Step 5: Commit:**
```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/mcp/tools/selectionTool.ts ableton-mcp/test/selectionTool.test.ts
git commit -m "feat: get_selection MCP tool"
```

---

## Task 5: `create_midi_clips` tool

Host-integration (SDK placement) — no unit test for the handler; the zod schema parse is tested. Verified at the Task 8 live gate.

**Files:** Create `src/mcp/tools/generate.ts`, `test/generate.test.ts`

- [ ] **Step 1: Failing test** at `test/generate.test.ts` (tests the exported schema only):
```ts
import { describe, it, expect } from "vitest";
import { ClipsInputShape } from "../src/mcp/tools/generate.js";
import { z } from "zod";

describe("create_midi_clips input schema", () => {
  const schema = z.object(ClipsInputShape);
  it("accepts a well-formed batch", () => {
    const parsed = schema.parse({
      clips: [{ sceneIndex: 0, lengthBeats: 4, notes: [{ pitch: 36, startTime: 0, duration: 0.5, velocity: 100 }] }],
    });
    expect(parsed.clips[0].sceneIndex).toBe(0);
  });
  it("rejects a clip missing sceneIndex", () => {
    expect(() => schema.parse({ clips: [{ lengthBeats: 4, notes: [] }] })).toThrow();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/mcp/tools/generate.ts`:
```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ableton from "@ableton-extensions/sdk";
import { getActiveSelection } from "../../selection/activeSelection.js";
import { validateNotes } from "../../agent/notes.js";
import { withSafeHandler } from "../../core/errors.js";

const NoteShape = z.object({
  pitch: z.number(),
  startTime: z.number(),
  duration: z.number(),
  velocity: z.number().optional(),
});

const ClipShape = z.object({
  trackIndex: z.number().optional(),
  sceneIndex: z.number(),
  lengthBeats: z.number(),
  name: z.string().optional(),
  notes: z.array(NoteShape),
});

/** Exported for unit testing the schema. */
export const ClipsInputShape = { clips: z.array(ClipShape) };

type ClipInput = z.infer<typeof ClipShape>;

export function registerGenerateTool(
  server: McpServer,
  context: ableton.ExtensionContext<"1.0.0">,
): void {
  server.registerTool(
    "create_midi_clips",
    {
      title: "Create MIDI clips",
      description:
        "Batch-create MIDI clips with notes in Session clip slots, applied as a single undo step. " +
        "Each clip targets song.tracks[trackIndex].clipSlots[sceneIndex]; trackIndex defaults to the " +
        "selected track. Times are in beats (0 = clip start). Only empty slots on MIDI tracks are filled; " +
        "occupied/non-MIDI/out-of-range targets are skipped and reported. Decide column (same track, " +
        "consecutive scenes) vs row (same scene, consecutive tracks) from the producer's wording.",
      inputSchema: ClipsInputShape,
    },
    withSafeHandler("create_midi_clips", async (args: { clips: ClipInput[] }) => {
      const sel = getActiveSelection();
      const song = context.application.song;
      const skipped: Array<{ sceneIndex: number; reason: string }> = [];
      const plans: Array<{ slot: ableton.ClipSlot<"1.0.0">; lengthBeats: number; notes: ReturnType<typeof validateNotes>; sceneIndex: number }> = [];

      for (const c of args.clips) {
        const trackIndex = c.trackIndex ?? sel?.trackIndex;
        if (trackIndex == null) { skipped.push({ sceneIndex: c.sceneIndex, reason: "no track (no selection)" }); continue; }
        const track = song.tracks[trackIndex];
        if (!track) { skipped.push({ sceneIndex: c.sceneIndex, reason: `track ${trackIndex} out of range` }); continue; }
        if (!(track instanceof ableton.MidiTrack)) { skipped.push({ sceneIndex: c.sceneIndex, reason: "not a MIDI track" }); continue; }
        const slot = track.clipSlots[c.sceneIndex];
        if (!slot) { skipped.push({ sceneIndex: c.sceneIndex, reason: `scene ${c.sceneIndex} out of range` }); continue; }
        if (slot.clip != null) { skipped.push({ sceneIndex: c.sceneIndex, reason: "slot occupied" }); continue; }
        plans.push({ slot, lengthBeats: c.lengthBeats, notes: validateNotes(c.notes), sceneIndex: c.sceneIndex });
      }

      const created: number[] = [];
      if (plans.length > 0) {
        await context.withinTransaction(() =>
          Promise.all(plans.map(async (p) => {
            const clip = await p.slot.createMidiClip(p.lengthBeats);
            clip.notes = p.notes;
            created.push(p.sceneIndex);
          })),
        );
      }

      return { content: [{ type: "text", text: JSON.stringify({ created: created.length, createdScenes: created, skipped }) }] };
    }),
  );
}
```

- [ ] **Step 4: Run, expect PASS** (schema test). Then `npx tsc --noEmit`. If tsc objects to `inputSchema: ClipsInputShape` (raw shape vs ZodObject) in SDK 1.29's `registerTool` typing, inspect the registerTool signature in `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` and adapt minimally (e.g. the shape is accepted directly — it is in 1.x). Do NOT use `any`; report any adaptation.

- [ ] **Step 5: Commit:**
```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/mcp/tools/generate.ts ableton-mcp/test/generate.test.ts
git commit -m "feat: create_midi_clips batch placement tool"
```

---

## Task 6: `ask_user` tool (host glue)

Host-integration — no unit test; verified at the live gate. Reuses the modal helpers.

**Files:** Create `src/mcp/tools/askUser.ts`

- [ ] **Step 1: Implement** `src/mcp/tools/askUser.ts`:
```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ableton from "@ableton-extensions/sdk";
import { buildQuestionModalHtml, toDataUrl } from "../../selection/modalHtml.js";
import { CANCEL_SENTINEL } from "../../selection/modalHtml.js";
import { withSafeHandler } from "../../core/errors.js";

export const AskUserShape = { question: z.string() };

export function registerAskUserTool(
  server: McpServer,
  context: ableton.ExtensionContext<"1.0.0">,
): void {
  server.registerTool(
    "ask_user",
    {
      title: "Ask the producer a question",
      description:
        "Open a small dialog in Ableton to ask the producer one short clarifying question and return their typed answer. " +
        "Use ONLY when the request is genuinely ambiguous (e.g. count or length truly unclear). Returns the answer string, or 'CANCELLED' if they cancel.",
      inputSchema: AskUserShape,
    },
    withSafeHandler("ask_user", async (args: { question: string }) => {
      const answer = await context.ui.showModalDialog(toDataUrl(buildQuestionModalHtml(args.question)), 460, 220);
      const text = !answer || answer === CANCEL_SENTINEL ? "CANCELLED" : answer;
      return { content: [{ type: "text", text }] };
    }),
  );
}
```

- [ ] **Step 2: Add `buildQuestionModalHtml` to `src/selection/modalHtml.ts`** (append this export; it mirrors the instruction modal but shows a question label and a single-line answer):
```ts
/** A modal that shows a question and returns the producer's short answer. */
export function buildQuestionModalHtml(question: string): string {
  const safe = question.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:14px -apple-system,system-ui,sans-serif;margin:0;padding:16px;background:#1e1e1e;color:#eee}
    input{width:100%;box-sizing:border-box;background:#2a2a2a;color:#eee;border:1px solid #444;border-radius:6px;padding:8px;font:14px inherit}
    .row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
    button{font:14px inherit;padding:8px 16px;border-radius:6px;border:0;cursor:pointer}
    .send{background:#3b82f6;color:#fff}.cancel{background:#3a3a3a;color:#ddd}
    p{margin:0 0 10px}</style></head><body>
    <p>${safe}</p>
    <input id="a" autofocus />
    <div class="row">
      <button class="cancel" onclick="post('${CANCEL_SENTINEL}')">Cancel</button>
      <button class="send" onclick="post(document.getElementById('a').value)">Answer</button>
    </div>
    <script>
      function post(v){
        var msg={method:"close_and_send",params:[v]};
        if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.live){window.webkit.messageHandlers.live.postMessage(msg);}
        else if(window.chrome&&window.chrome.webview){window.chrome.webview.postMessage(msg);}
      }
      document.getElementById('a').addEventListener('keydown',function(e){if(e.key==='Enter'){post(document.getElementById('a').value);}});
    </script></body></html>`;
}
```

- [ ] **Step 3: Typecheck + build:** `cd /Volumes/ExtData2/coding/thefck/ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx tsc --noEmit && npm run build`. Expected: clean + dist written.

- [ ] **Step 4: Commit:**
```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/mcp/tools/askUser.ts ableton-mcp/src/selection/modalHtml.ts
git commit -m "feat: ask_user MCP tool (reverse questions) + question modal"
```

---

## Task 7: Register tools + stash selection + prompt update

**Files:** Modify `src/mcp/server.ts`, `src/selection/askClaude.ts`, `src/agent/prompt.ts`; Test `test/prompt.test.ts` (update)

- [ ] **Step 1: Register the new tools in `src/mcp/server.ts`.** Add imports and call the registrations inside `buildMcpServer` after `registerSongTools(server, context)`:
```ts
import { registerSelectionTool } from "./tools/selectionTool.js";
import { registerAskUserTool } from "./tools/askUser.js";
import { registerGenerateTool } from "./tools/generate.js";
// ... inside buildMcpServer, after registerSongTools(server, context):
  registerSelectionTool(server);
  registerAskUserTool(server, context);
  registerGenerateTool(server, context);
```

- [ ] **Step 2: Stash the active selection in `src/selection/askClaude.ts`.** Add imports:
```ts
import { setActiveSelection } from "./activeSelection.js";
import { resolveSlotPosition } from "./resolveSlot.js";
```
In the command handler, AFTER `const selection = captureClipSlot(slot as unknown as ClipSlotLike);` and BEFORE the `showModalDialog` call, insert:
```ts
      // Resolve where this slot is and stash it for the get_selection / create_midi_clips tools.
      try {
        const song = context.application.song;
        const pos = resolveSlotPosition(
          song as unknown as { tracks: ReadonlyArray<{ clipSlots: ReadonlyArray<object> }> },
          slot as unknown as object,
        );
        if (pos) {
          const track = song.tracks[pos.trackIndex];
          setActiveSelection({
            trackIndex: pos.trackIndex,
            trackName: track.name,
            isMidiTrack: track instanceof ableton.MidiTrack,
            sceneIndex: pos.sceneIndex,
            hasClip: selection.hasClip,
            totalTracks: song.tracks.length,
            totalScenes: track.clipSlots.length,
          });
        } else {
          setActiveSelection(null);
        }
      } catch {
        setActiveSelection(null);
      }
```

- [ ] **Step 3: Update the prompt** in `src/agent/prompt.ts` — replace the body of `composePrompt` with generative guidance (keep the signature). New implementation:
```ts
import type { SelectionContext } from "../selection/types.js";

/** Build the headless-claude prompt from the captured selection + the producer's instruction. */
export function composePrompt(selection: SelectionContext, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    "You are a music-production assistant working INSIDE Ableton Live for a producer.",
    "Available MCP tools: get_song_overview, get_selection, ask_user, create_midi_clips.",
    `The producer right-clicked a Session clip slot (hasClip=${selection.hasClip}) and asked:`,
    `"${trimmed}"`,
    "Workflow:",
    "1. Call get_selection to learn the track/scene and whether it's a MIDI track.",
    "2. If — and only if — the request is genuinely ambiguous about count or length, call ask_user with ONE short question. Otherwise pick sensible defaults (e.g. 1 clip, 1 bar = 4 beats).",
    "3. Generate the MIDI (drums use GM pitches: kick 36, snare 38, closed-hat 42, open-hat 46; melodies/bass use pitched notes in a fitting key). Times are in beats, 0 = clip start.",
    "4. Place everything in ONE create_midi_clips call. Infer column (same track, consecutive scenes from the selected one) vs row (consecutive tracks, same scene) from the wording.",
    "Be efficient: do not narrate your reasoning. End with a one-sentence summary of what you placed.",
  ].join("\n");
}
```

- [ ] **Step 4: Update `test/prompt.test.ts`** to match the new prompt (replace the existing test file content):
```ts
import { describe, it, expect } from "vitest";
import { composePrompt } from "../src/agent/prompt.js";

describe("composePrompt", () => {
  it("embeds the instruction and selection and names the generative tools", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: false }, "build me 4 two-step beats");
    expect(p).toContain("build me 4 two-step beats");
    expect(p).toContain("hasClip=false");
    expect(p).toContain("create_midi_clips");
    expect(p).toContain("ask_user");
    expect(p).toContain("get_selection");
  });
  it("instructs asking only when genuinely ambiguous", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: true }, "");
    expect(p.toLowerCase()).toContain("ambiguous");
    expect(p.length).toBeGreaterThan(40);
  });
});
```

- [ ] **Step 5: Typecheck, test, build:** `cd /Volumes/ExtData2/coding/thefck/ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx tsc --noEmit && npx vitest run && npm run build`. Expected: tsc clean; ALL tests pass; dist written.

- [ ] **Step 6: Commit:**
```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/mcp/server.ts ableton-mcp/src/selection/askClaude.ts ableton-mcp/src/agent/prompt.ts ableton-mcp/test/prompt.test.ts
git commit -m "feat: register generative tools, stash active selection, generative prompt"
```

---

## Task 8: Live gate — generate & place in Ableton

Verification task (no new code). Confirms the three host unknowns: `ask_user` mid-run, `create_midi_clips` placement, multi-cell + undo.

- [ ] **Step 1: Restart host with the new build:**
```bash
export PATH="/Users/thomasgallaway/.asdf/shims:$PATH"
pkill -9 -f "ExtensionHostNodeModule|extensions-cli" 2>/dev/null; sleep 1
cd /Volumes/ExtData2/coding/thefck/ableton-mcp && npm run build
npx extensions-cli run --live "/Volumes/ExtData/Applications/Ableton Live 12 Beta.app" > /tmp/ableton-mcp-run.log 2>&1 &
```
Wait for `registered "Ask Claude…" on ClipSlot` in `/tmp/ableton-mcp-run.log`.

- [ ] **Step 2: Tool sanity over http** (proves the new tools are registered):
```bash
TOKEN=$(grep -o 'Bearer [a-f0-9]\{64\}' /tmp/ableton-mcp-run.log | head -1 | awk '{print $2}')
curl -s -X POST http://127.0.0.1:9787/mcp -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" -H "accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | grep -o '"name":"[^"]*"'
```
Expected: lists `get_song_overview`, `get_selection`, `ask_user`, `create_midi_clips`.

- [ ] **Step 3: Unambiguous generate (no ask_user).** In Live, right-click an **empty cell on a MIDI/instrument track** (e.g. a Serum/Massive cell) → "Ask Claude…" → type: `make a 1-bar boom-bap drum pattern here`. Send.
Expected: after ~15–25s, a result modal says it placed a clip; the cell now holds a MIDI clip with notes (double-click to confirm kick/snare/hats).

- [ ] **Step 4: Reverse-question path.** Right-click another empty MIDI cell → "Ask Claude…" → type: `build me some dope 2-step beats`. Send.
Expected: a second modal appears asking something like "How many?" → type `4` → after generation, **4 clips** appear (down the column or as Claude chose); result modal summarizes. This confirms `ask_user` works mid-run.

- [ ] **Step 5: Undo is one step.** Press ⌘Z once.
Expected: all clips from the last `create_midi_clips` call disappear together (single undo step).

- [ ] **Step 6: Skip reporting.** Right-click an **occupied** cell (or a cell on an **audio** track) → "Ask Claude…" → `put a clip here`.
Expected: result reports it was skipped (occupied / not a MIDI track) rather than crashing; host still listening (`lsof -nP -iTCP:9787 | grep LISTEN`).

- [ ] **Step 7: Record verification** in the spec and commit:
```bash
cd /Volumes/ExtData2/coding/thefck
# append an "AC-M1 verified (date)" note summarizing steps 3-6 to docs/superpowers/specs/2026-06-02-ask-claude-feature-design.md
git add docs/superpowers/specs/2026-06-02-ask-claude-feature-design.md
git commit -m "docs: record AC-M1 live verification"
```

---

## Self-Review

**Spec coverage (§9):** `get_selection` → Task 4 ✅; `ask_user` → Task 6 ✅; `create_midi_clips` (zod, transaction, skip/occupied/non-MIDI reporting, trackIndex default) → Task 5 ✅; active-selection store → Task 1 ✅; slot resolution → Task 2 ✅; note validation → Task 3 ✅; tool registration → Task 7 Step 1 ✅; stash selection before spawn → Task 7 Step 2 ✅; generative prompt (infer placement, ask-only-if-ambiguous, terse, drums+melodies) → Task 7 Step 3 ✅; multi-cell + undo + de-risk (ask_user mid-run) → Task 8 ✅.

**Placeholder scan:** No TBD/TODO; every code step has complete code; every run step has command + expected output. The Task 5/7 "inspect registerTool/SDK types if it objects" notes are conditional verification tied to a concrete file, not deferred work.

**Type consistency:** `ActiveSelection` (T1) consumed in `serializeActiveSelection` (T4) and set in askClaude (T7). `resolveSlotPosition`/`SongLike` (T2) used in T7 Step 2. `validateNotes`/`MidiNote` (T3) used in `generate.ts` (T5). `ClipsInputShape` (T5) tested in T5 Step 1. `getActiveSelection`/`setActiveSelection` (T1) used in T4/T5/T7. `buildQuestionModalHtml`/`toDataUrl`/`CANCEL_SENTINEL` (T6/M0) used in `askUser.ts` (T6). `registerSelectionTool`/`registerAskUserTool`/`registerGenerateTool` (T4/T5/T6) called in `server.ts` (T7). `withSafeHandler` (M0) used by all new tools. `composePrompt` signature unchanged (T7 Step 3) so askClaude's call still compiles.

**Note (carried from AC-M0 review, address in a later milestone):** the result-modal cost string and prompt instruction-delimiter hardening (MEDIUMs) remain open; `ask_user` while the progress dialog is open is the key risk Task 8 Step 4 validates — if it fails, fall back to removing the `withinProgressDialog` wrapper in `askClaude.ts` so the ask modal can show.
