# "Ask Claude" — Selection-Driven In-Ableton Agent — Design

**Date:** 2026-06-02
**Status:** Design (post-spike), pending review → implementation plan
**Builds on:** M0 (extension-as-MCP-server, on `main`). See
`2026-06-02-ableton-mcp-extension-design.md`.

---

## AC-M0 — VERIFIED LIVE (2026-06-02)

Implemented and verified end-to-end in Ableton Live 12 Beta: right-click a Session clip
slot → "Ask Claude…" → modal text box returns the typed instruction → the host spawns
`claude` headless (Sonnet, `--allowedTools mcp__ableton__*`, `--max-turns 12`, no bypass)
against the extension's own MCP server → Claude calls `get_song_overview` and answers.
Confirmed: `is_error:false`, real result ("tempo 97, 12 tracks, G Minor"), cost shown
($0.13, 3 turns, ~17s). Modal text-return ✓, in-host spawn ✓, tool use ✓, cost ✓, no host
crash. 8 commits on `main` after merge. Next: AC-M1 (generative placement, below).

## 1. Vision

A producer-initiated, in-Ableton AI assistant that **enhances production, not replaces
the producer** (user's framing, 2026-06-02). The producer right-clicks an object in Live
(starting with a Session clip slot), picks **"Ask Claude…"**, types a natural-language
instruction, and Claude performs the edit **on that exact object** using the extension's
Ableton MCP tools. The human stays in the driver's seat: nothing happens unless they
right-click and ask.

## 2. Architecture (proven by spikes 2026-06-02)

```
Right-click clip slot → "Ask Claude…"  (context-menu action; command gets the ClipSlot handle)
   │
   ▼  ui.showModalDialog(<textarea form>)  → producer types instruction → returns the text
   │
   ▼  Extension composes a prompt = { selection context + instruction }
   │
   ▼  child_process.spawn(<abs claude path>, ["-p", prompt,
   │       "--mcp-config", <temp: our http url+token>, "--strict-mcp-config",
   │       "--allowedTools", "mcp__ableton__*", "--model", <configured>,
   │       "--output-format", "json"], { env: process.env })
   │
   ▼  Claude (headless) calls our Ableton MCP tools  → edits the selected object in Live
   │
   ▼  ui.withinProgressDialog shows status + Cancel (AbortSignal → child.kill())
   │
   ▼  Result text surfaced back to the producer
```

The extension is **both** the MCP server (Claude's hands) **and** the caller that spawns
Claude with the producer's instruction. Self-contained; no external bridge.

## 3. Spike findings that constrain the design

- ✅ **Headless spawn works:** the host Node process can `spawn` the `claude` CLI by
  absolute path and drive the MCP loop; it returned live data (`get_song_overview` →
  track count "12") with `is_error:false`, `permission_denials:[]`.
- ⚠️ **Auth via environment:** a stripped env → "Not logged in · Please run /login". The
  spawn MUST inherit the host's `process.env`. **Production caveat:** a GUI-launched
  Extension Host may not carry the same auth a dev shell does → an auth/setup step is a
  later-milestone requirement (documented, not a dev blocker). We never read/handle the
  secret ourselves.
- ✅ **Safe permissions, no bypass:** `--allowedTools "mcp__ableton__*"` + default
  permission mode ran tools with zero denials. `bypassPermissions` is forbidden (user's
  CLAUDE.md) and unnecessary — the producer's typed instruction is the authorization,
  and the allowlist scopes Claude to our tools only.
- 💰 **Cost/model:** Opus ≈ $0.7/call (cache-creation heavy); **Sonnet** ≈ 5× cheaper is
  the **default**, configurable. ~10s latency → wrap in a progress dialog.
- ❓ **Unverified (live-gate it):** that `ui.showModalDialog` actually returns the typed
  text in the host (macOS `webkit.messageHandlers.live.postMessage` `close_and_send`).

## 4. Components (new files; extends M0's `src/`)

```
src/
  selection/
    contextMenu.ts     // register "Ask Claude…" on ClipSlot (later: MidiClip, Track, Scene)
    capture.ts         // resolve handle → SelectionContext snapshot; hold "active selection"
    modal.ts           // build the data: URL HTML form; showModalDialog → instruction text
  agent/
    spawnClaude.ts     // child_process spawn, arg/env build, JSON result parse, abort→kill
    prompt.ts          // compose prompt from SelectionContext + instruction
    mcpConfigFile.ts   // write temp --mcp-config JSON (our url + bearer token), cleanup
  mcp/tools/
    selection.ts       // get_selection (read captured context)
    clips.ts           // create_midi_clip_in_selection(lengthBeats)
    notes.ts           // write_notes_to_selected_clip(notes[])  (NoteDescription[])
  core/
    agentConfig.ts     // claude binary path (auto-detect), default model, allowed tools, timeout
```

## 5. Security

- MCP server stays bound to 127.0.0.1 + bearer token (M0).
- Spawned Claude is allowlisted to `mcp__ableton__*` only; **no `bypassPermissions`**.
- The `--mcp-config` temp file (contains the token) is written `0600` in the extension's
  temp dir and deleted after the run.
- We pass through `process.env` for auth but never log/persist credential values.
- Modal HTML is static (no remote code); instruction text is treated as data in the prompt.

## 6. Decomposition (each milestone independently testable; ends with a live gate)

- **AC-M0 — de-risk the two new host integrations.** "Ask Claude…" on `ClipSlot` →
  modal returns text → spawn claude (with a single trivial tool, e.g. `get_selection`
  echo) → show its result in a dialog. Proves `showModalDialog` text return + in-host
  spawn end-to-end in real Live.
- **AC-M1 — read the selection.** `SelectionContext` capture + `get_selection` MCP tool +
  `prompt.ts`. Claude can accurately *describe* the right-clicked cell.
- **AC-M2 — act on the selection.** `create_midi_clip_in_selection` +
  `write_notes_to_selected_clip`. End-to-end: right-click empty cell → "make a 4-bar
  minor-key bassline" → notes appear.
- **AC-M3 — UX hardening.** Progress dialog + Cancel (kill child), model selector in the
  modal, structured error surfacing, one-run-at-a-time guard per slot.
- **AC-M4 — broaden + ship.** More scopes (right-click a `MidiClip` → edit its notes;
  `Track`; `Scene`), settings (model, binary path, auth), `.ablx` packaging, and the
  production auth story.

## 6.5 Cost visibility & controls

Each "Ask Claude" is a billable run against the producer's own Claude auth (subscription
usage/quota, or API $). No surcharge — it's the official `claude` CLI logged in as them —
but the cost is real and per-invocation, so the feature surfaces and bounds it:

- **Show cost after each run.** The result dialog displays `total_cost_usd`, `num_turns`,
  and model used (parsed from the `--output-format json` result), so spend is never hidden.
- **Model default = Sonnet**, selectable per call (Haiku cheap / Opus only when wanted).
- **Turn/budget cap.** Pass `--max-turns <N>` (configurable, default e.g. 12) so a run
  can't loop unboundedly; surface "hit turn cap" clearly if reached.
- **Prompt caching** (1h TTL on tool schemas/system prompt) makes rapid successive calls
  much cheaper cache-reads — don't churn the system prompt between calls.
- **One-run-at-a-time guard** (AC-M3) prevents accidental parallel spend.
- We do **not** handle or proxy credentials — spawn inherits the host env and uses the
  first-party CLI, staying within Anthropic ToS (no subscription-credential proxying).

## 7. Open decisions (resolved)

- Default model: **Sonnet** (configurable). 
- Invocation: **extension spawns Claude headless** (chosen over queue-and-poll / direct API).
- First scope: **Session `ClipSlot`** (matches "the cell I have selected").

## 8. Dependencies added

None beyond M0 + Node `child_process` (stdlib). Claude CLI is an external runtime
dependency the producer already has installed and authenticated.
