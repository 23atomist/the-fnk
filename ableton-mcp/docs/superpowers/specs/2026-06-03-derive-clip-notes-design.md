# AC-M2 — Derive a New Clip from an Existing One — Design

**Date:** 2026-06-03
**Status:** Design, approved → spec review → implementation plan
**Builds on:** AC-M1 (generative MIDI placement: `create_midi_clips`, relative placement,
`get_selection`, `musicGuidance`). See `2026-06-02-ask-claude-feature-design.md`.

---

## 1. Goal

Let the producer point at an existing clip and ask Claude to generate a **derived** part on
another cell — e.g. right-click a melody cell and say *"make me a bass from this"*. Today the
system is **write-only on empty cells** and **blind to existing musical content**:

- `get_selection` reports the clicked cell but only `hasClip: true/false` — not the notes
  (`src/selection/activeSelection.ts`).
- `get_song_overview` has tempo/tracks/scale but no note data.
- `create_midi_clips` fills only **empty** MIDI slots; occupied slots are skipped by design
  (`src/mcp/tools/generate.ts`).

The single missing foundation is **reading the notes out of an existing clip**. Once Claude can
see the source material, AC-M1's relative/absolute placement already handles writing the derived
part into another cell.

## 2. Scope

**In scope — Feature A, "derive to a new cell":** read a source clip → generate a derived part
(bass / harmony / counter-melody) → write it into a **different empty cell**. Purely additive;
reuses `create_midi_clips` unchanged.

**Explicitly out of scope (deferred):**
- **Feature B, "augment in place"** — overwriting an occupied slot to extend/humanize/vary an
  existing clip. Requires destructive overwrite of occupied slots; revisit as AC-M3.
- Audio-clip analysis (only MIDI clips are read).

## 3. Architecture / workflow

```
Right-click SOURCE cell → "Ask Claude…" → "make me a bass from this melody"
   │
   ▼  get_selection            → which cell did the producer click (source)
   │
   ▼  get_clip_notes           → READ the source clip's notes (NEW TOOL)
   │
   ▼  get_song_overview        → find a destination track matching intent (e.g. "Bass")
   │
   ▼  (derive notes in-model, guided by musicGuidance "derivation" section)
   │
   ▼  create_midi_clips        → write derived clip into the destination empty cell
                                  (absolute trackIndex of matched track, same sceneIndex)
```

No new placement code: destination resolution is **prompt/guidance only**, on top of AC-M1's
existing absolute placement. When no track clearly matches the producer's intent, fall back to
the existing `ask_user` modal to pick a destination.

## 4. Components

### 4.1 `get_clip_notes` — new read-only MCP tool (the only new code path)

Returns the musical content of a cell so Claude can reason about it.

- **Input:** `trackIndex?`, `sceneIndex?` — both optional, **default to the active selection's
  track/scene**.
  - **Decision (noted for review):** absolute-only, no relative `trackOffset`/`sceneOffset`.
    The source is almost always the clicked cell (covered by the default), and explicit indices
    cover "also read the drums on track 2". YAGNI on offsets — flag if you want symmetry with
    `create_midi_clips`.
- **Output — occupied MIDI cell:**
  ```json
  { "hasClip": true, "isMidi": true, "name": "Melody",
    "lengthBeats": 4, "looping": true,
    "notes": [ { "pitch": 60, "startTime": 0, "duration": 1, "velocity": 100 } ] }
  ```
  `lengthBeats` derived from `loopEnd - loopStart`.
- **Output — edge cases:** empty slot → `{ "hasClip": false }`; audio clip →
  `{ "hasClip": true, "isMidi": false }`; track/scene out of range → reported error.
  Mirrors the honest skip-reporting style already in `create_midi_clips`.
- **No transaction** — pure read via the `slot.clip` getter. Read-only; cannot mutate the set.

### 4.2 Destination resolution — "Claude decides from context" (no new code)

Claude reads `get_song_overview`, matches the producer's words to a track (e.g. one named
"Bass"), and targets that track's index on the source's scene row via `create_midi_clips`.
Ambiguous → `ask_user`. Implemented purely as prompt + guidance.

### 4.3 Generation prompt update (`src/agent/prompt.ts`)

Teach the agent the derive workflow: when the producer references existing material ("from this
melody", "based on this", "make a bass for this"), **read the source with `get_clip_notes`
before generating**, then resolve the destination track from the overview.

### 4.4 Derivation guidance (`src/agent/musicGuidance.ts`)

Add a "deriving a part from source material" section, consistent with AC-M1's prompt-driven
philosophy: lock to the source's key/scale and clip length; for a **bass**, follow
chord-root / strong-beat pitches an octave or two down, simplify rhythm toward downbeats and
sustains, leave space. Written generically so it also covers counter-melody / harmony later.

### 4.5 Tests

Unit tests for `get_clip_notes` serialization, mirroring `test/selectionTool.test.ts` and
`test/generate.test.ts` (pure function, no live host):
- occupied MIDI clip → notes + lengthBeats returned
- empty slot → `hasClip:false`
- audio clip → `isMidi:false`
- track/scene out of range → error
- default-to-selection vs explicit `trackIndex`/`sceneIndex`

## 5. SDK facts confirmed (2026-06-03)

Verified against `@ableton-extensions/sdk` `1.0.0-beta.0` `dist/index.d.mts`:

- `MidiClip.notes` is a **readable getter** (`get notes(): NoteDescription[]`) — the whole
  unlock; reading existing clips works.
- `Clip` base exposes `name`, `loopStart`, `loopEnd`, `looping`, `duration` for length/context.
- `ClipSlot.clip` returns `Clip | null`; narrow with `instanceof MidiClip` (matches the existing
  `instanceof MidiTrack` pattern in `askClaude.ts`).
- `NoteDescription`: `pitch`, `startTime`, `duration`, optional `velocity`, plus `muted`,
  `probability`, `velocityDeviation`, `releaseVelocity`. We surface pitch/start/duration/velocity;
  others optional.

No feasibility risk: reading notes is a synchronous getter on the resolved slot's clip.

## 6. Success criteria

Right-click a melody clip → "make me a bass from this" → Claude reads the melody via
`get_clip_notes`, finds the bass track from the overview, and writes a musically-coherent bass
clip into that track's empty cell on the same scene — as a single undo step, with honest
reporting of any skipped target.
