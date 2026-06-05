# Ableton MCP — in-Ableton AI music assistant

An Ableton Live 12 **Extension** that adds an **"Ask Claude…"** action to Session clip slots.
Right-click a cell, type a natural-language instruction, and Claude generates or edits MIDI in
Live through the extension's own built-in MCP server. The producer stays in control — nothing
happens unless you right-click and ask.

The extension is **both** the MCP server (Claude's hands in Live) and the caller that spawns
Claude headless with your instruction. Self-contained; no external bridge.

## Requirements

- **Ableton Live 12** with the **Extensions / Extension Host** feature (currently a Beta
  capability). The extension runs inside Live's bundled Node runtime — you don't install Node
  separately for it to *run*.
- **Ableton Extensions beta SDK + CLI** — `@ableton-extensions/sdk` and
  `@ableton-extensions/cli`. These are not on npm; the beta tarballs are vendored in
  [`vendor/`](./vendor) and referenced via `file:vendor/*.tgz` in `package.json`. The CLI
  (`extensions-cli`) runs the Extension Host in dev and packages the distributable `.ablx`.
- **Claude Code CLI** (`claude`) — installed **and logged in**. The extension spawns it headless
  to drive generation, so it must be authenticated (run `claude` once and complete `/login`).
  Install: https://docs.claude.com/claude-code.
- **Node.js 22+** and npm — to build the extension from source (`tsc` + `esbuild`).

## Run from source (development)

```bash
npm install            # resolves the vendored SDK/CLI from vendor/
npm run build          # tsc --noEmit && esbuild → dist/extension.js

# IMPORTANT: launch Ableton Live FIRST and let it finish booting, then:
npm start              # builds, then runs the Extension Host against the running Live
```

Then in Live's **Session view**, right-click an empty MIDI clip slot → **"Ask Claude…"**.

On first start the host prints how to connect (and the MCP server URL). The "Ask Claude…" run
registers the server with Claude automatically — you don't need to wire anything up manually.

### Gotchas (see `npm start` output and the host logs)

- **Live must already be running** — `extensions-cli run` attaches to a running Live; it does
  **not** launch Live. Starting the host before Live is ready leaves it waiting with no menu.
- **One host at a time** — only one Extension Host may be connected to Live. To redeploy after a
  code change, keep Live running and restart just the host:
  `pkill -f ExtensionHostNodeModule; npm start`.
- **Don't force-quit Live** — it triggers a crash-recovery dialog on next launch that blocks the
  extension from loading until dismissed. Quit Live normally.

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `ABLETON_MCP_PORT` | `9787` | Port for the extension's localhost MCP server. |
| `ABLETON_MCP_CLAUDE_PATH` | auto-detect (`~/.local/bin/claude`, then `PATH`) | Path to the `claude` CLI to spawn. |

## MCP tools the agent can call

- `get_song_overview` — tempo, tracks, scenes, current scale.
- `get_selection` — the right-clicked cell (track/scene, is-MIDI, hasClip, totals).
- `get_clip_notes` — read an existing clip's notes (to derive a new part from it).
- `create_midi_clips` — batch-create MIDI clips in empty slots (one undo step).
- `ask_user` — ask the producer a short clarifying question.

## Tests

```bash
npx vitest run         # unit tests for the pure logic (no live host needed)
```

## Releases

Releases are built by GitHub Actions (`.github/workflows/release.yml`, at the repo root) on a
**self-hosted Linux runner**:

- **Test the pipeline:** Actions → "Release .ablx" → Run workflow → inspect the uploaded
  `.ablx` build artifact (no Release created).
- **Cut a release:** `git tag vX.Y.Z && git push origin vX.Y.Z` → builds, tests, packages
  `ableton-mcp-X.Y.Z.ablx` (bundling the runtime deps), and publishes a GitHub Release with it
  attached. The git tag is the source of truth for the version.

Install a released build by downloading the `.ablx` from the Releases page and adding it to
Ableton Live's Extensions.
