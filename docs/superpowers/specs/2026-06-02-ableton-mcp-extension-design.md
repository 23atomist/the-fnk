# Ableton MCP Extension — Design

**Date:** 2026-06-02
**Status:** Approved (design), pending spec review → implementation plan
**Author:** brainstormed with Claude

---

## 1. Problem & Goal

The existing `ableton-mcp` approach runs **two processes**: a standalone MCP server
(launched by Claude) that talks over TCP to a Max-for-Live / Remote Script socket
running inside Ableton Live. It is a bridge/hack: the MCP server is not Ableton, it
just relays to it.

**Goal:** Build a single Ableton Live extension (using the new
`@ableton-extensions/sdk`) that **is** the MCP server. On activation it starts a
localhost HTTP server speaking the MCP Streamable-HTTP transport. Its tool handlers
call directly into the Ableton SDK. Claude connects to that URL. One process, no
bridge, no Remote Script, no manual TCP.

**Target surface (end state):** the full SDK — song/transport, tracks, clips, MIDI
note editing, devices/params/racks, resources (import/render), undo transactions.
Built in safe increments (M0–M5 below).

---

## 2. Feasibility — PROVEN by spike (2026-06-02)

A throwaway spike (`/tmp/mcp-spike`) loaded into **Ableton Live 12 Beta**
(`/Volumes/ExtData/Applications/Ableton Live 12 Beta.app`) confirmed the entire
architecture against a live project:

| Question | Result |
|---|---|
| Does `activate()` fire? | ✅ Yes, ~4–5s after Live connects to the host |
| Does `ableton.initialize()` succeed? | ✅ `sdkInit: "ok"` — live data model reachable |
| Can a `node:http` server bind in the host? | ✅ `127.0.0.1:9876` LISTEN, confirmed by `lsof` + `curl` |
| Can a handler READ live data? | ✅ `/song` returned real tracks, tempo, scenes |
| Can a handler WRITE (sync setter)? | ✅ `/tempo?bpm=128` persisted |
| Can a handler do an ASYNC mutation? | ✅ `/create-midi-track` created a track |
| Node version in host | `v24.14.1`, full stdlib via `node:` imports |

### Hard constraints discovered (these shape the design)

1. **Restricted globals.** The host does NOT expose web globals like `URL` on
   `globalThis` (the spike crashed with `ReferenceError: URL is not defined` until we
   imported from `node:url`). The official MCP SDK depends on `URL`,
   `crypto.randomUUID`, `Headers`, `ReadableStream`, etc. → we MUST inject these
   globals into the bundle before SDK code runs.
2. **Uncaught exceptions kill the entire host process** (exit 1), taking down Live's
   extension support. → Bulletproof error isolation is non-negotiable.
3. **No hot reload.** Editing requires rebuild + host restart. Dev-ergonomics only.
4. **Host is launched standalone** by `extensions-cli run` and idles until the Live
   GUI connects; `activate()` runs only after the Live handshake completes.

---

## 3. Architecture

```
Claude (MCP client)
   │  HTTP POST/GET /mcp   (JSON-RPC 2.0, Authorization: Bearer <token>)
   ▼
node:http server (127.0.0.1:<port>)
   │  StreamableHTTPServerTransport
   ▼
McpServer  ──tools/call──▶  tool handler (zod-validated, error-wrapped)
   │
   ▼
Ableton SDK  (context.application.song, context.commands, context.resources, …)
   │
   ▼
live Ableton Live
```

### Decision: MCP layer = official SDK + global shims
We use `@modelcontextprotocol/sdk` (`McpServer` + `StreamableHTTPServerTransport`)
for spec-correct protocol handling (session management, SSE, capability
negotiation, version tracking). The restricted-globals friction is handled by an
esbuild banner that injects the missing globals from `node:` modules before any SDK
code runs. **Milestone 0 exists specifically to prove this path early.**

---

## 4. Components (many small files, <400 lines each)

```
project root
  manifest.json          // Ableton extension manifest
  package.json           // deps: @ableton-extensions/sdk, @modelcontextprotocol/sdk, zod
  build.ts               // esbuild: cjs/node, banner injects globals, node: external
  tsconfig.json
  src/
    extension.ts         // activate(): wiring only (~40 lines)
    globals.ts           // inject URL, URLSearchParams, crypto.webcrypto, Headers,
                         //   Request/Response/fetch, ReadableStream/TransformStream,
                         //   TextEncoder/TextDecoder — ONLY the ones actually missing
    core/
      errors.ts          // process uncaughtException/unhandledRejection guards;
                         //   withSafeHandler() wrapper (never throws out of a handler)
      config.ts          // port (default 9787 + override), storage paths
      logger.ts          // host-safe logging (no secrets to stdout)
    server/
      httpServer.ts      // node:http server, mounts transport, EADDRINUSE handling
      auth.ts            // token generate/verify (constant-time), 0600 storage
    mcp/
      server.ts          // builds McpServer, registers all tool modules
      tools/
        song.ts          // overview, tempo, scale, scenes, transport
        tracks.ts        // create/delete/rename/duplicate; mixer vol/pan/sends
        clips.ts         // create audio/midi clips, loop settings, warp
        notes.ts         // MIDI note read/write, quantize length+start, velocity ops
        devices.ts       // list/insert built-in devices, params, racks/chains, simpler
        resources.ts     // import file into project, render pre-fx audio
    sdk/
      serialize.ts       // SDK object → plain immutable JSON snapshot
      lookup.ts          // resolve track/clip/device by name or index; handle resolve
```

Each tool = a **zod input schema** + a handler wrapped by `core/errors.withSafeHandler`.

---

## 5. MIDI note editing (explicit M3 deliverable)

`MidiClip.notes` is a get/set array of:
```ts
NoteDescription = { pitch, startTime, duration, velocity?, muted?,
                    probability?, velocityDeviation?, releaseVelocity?, selected? }
```
This makes the following first-class tools (read-modify-write the array; math lives in
`mcp/tools/notes.ts`):
- `quantize_note_starts` — snap `startTime` to a grid (1/4, 1/8, 1/16, triplets…),
  with optional strength (0–100%).
- `quantize_note_lengths` — snap `duration` to a grid / fixed length.
- `set_note_velocities` — set/scale/randomize `velocity` across selected or all notes.
- `transpose_notes`, `humanize`, `mute/unmute`, `set_probability` — same pattern.

---

## 6. Error isolation (hard requirement)

- **Every tool handler** wrapped by `withSafeHandler`: catches all errors → returns
  MCP `isError` content with a clean message; **never throws**.
- `process.on('uncaughtException')` and `process.on('unhandledRejection')` → log and
  **stay alive** (the spike proved an uncaught throw kills the host).
- `server.on('error')` handles `EADDRINUSE` → surface clearly, optionally try next port.
- zod validation at every tool boundary; invalid input → structured MCP error, no throw.

---

## 7. Security

- **Bind 127.0.0.1 only.** Never 0.0.0.0.
- **Bearer token** required on every request. Generated once
  (`crypto.randomBytes`), stored `0600` in `environment.storageDirectory`,
  **constant-time** compared.
- Token never written to stdout logs. Surfaced via a context-menu **"Show MCP
  connection info"** action that opens a modal (`ui.showModalDialog`) containing the
  ready-to-paste command:
  ```
  claude mcp add --transport http ableton \
    http://127.0.0.1:9787/mcp \
    --header "Authorization: Bearer <token>"
  ```
- Rationale: any local process can otherwise reach the port and drive Ableton.

---

## 8. Lifecycle

- **Dev:** `extensions-cli run --live "<Live.app>"` with Live running. Proven.
- **Prod:** `extensions-cli package` → `.ablx`, installed in Live; Live auto-launches
  the host on startup → same `activate()` path. *(Prod auto-launch confirmation is an
  M5 checkpoint.)*

---

## 9. Testing (80% coverage target)

- **Unit (Vitest):** tool handlers against a **mocked `context`** (fake SDK objects);
  `serialize`, `lookup`, `auth`, `withSafeHandler`, quantize math (pure, fully testable).
- **Integration:** drive the in-process `McpServer` with the MCP SDK *client* over http
  using a stub context; assert `tools/list` and representative `tools/call` round-trips.
- **E2E:** scripted run in Live 12 Beta exercising representative tools (the spike
  pattern, automated).

---

## 10. Build order (full surface, safe increments)

- **M0 — de-risk the chosen path.** Bundle MCP SDK + global shims; `tools/list` +
  `get_song_overview` working in Live with Claude actually connected. Gate: if shims
  prove fragile, revisit (fallback = lean hand-rolled MCP-over-HTTP).
- **M1 — read.** Read tools across song/tracks/clips/devices + `sdk/serialize`,
  `sdk/lookup`.
- **M2 — write basics.** Tracks CRUD, tempo, scenes, mixer (vol/pan/sends).
- **M3 — creative depth.** Clips (audio/midi) + **MIDI note editing & quantize/velocity**
  + warp; device insert + params; racks/chains/simpler.
- **M4 — resources & UX of editing.** Import file, render audio, undo transactions
  (`withinTransaction`), progress dialogs for long ops.
- **M5 — ship.** Auth hardening, connection-info modal, `.ablx` packaging, prod
  lifecycle confirmation, README/docs.

---

## 11. Open items resolved during brainstorming

- Port: **fixed default 9787 with override** (predictable for Claude config).
- MCP layer: **official SDK + shims** (chosen), hand-rolled kept as documented fallback.
- Security: **bearer token kept** even for local-only first cut.

## 12. Dependencies added

`@modelcontextprotocol/sdk`, `zod`. esbuild bundles CJS/node with a banner injecting
web globals before SDK code runs; `node:` builtins remain external.
