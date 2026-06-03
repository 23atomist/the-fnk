import * as os from "node:os";
import * as fs from "node:fs";
import * as ableton from "@ableton-extensions/sdk";
import { log } from "../core/logger.js";
import { HOST, PORT, MCP_PATH } from "../core/config.js";
import { DEFAULT_MODEL, ALLOWED_TOOLS, MAX_TURNS, resolveClaudePath } from "../core/agentConfig.js";
import { captureClipSlot, type ClipSlotLike } from "./capture.js";
import { setActiveSelection } from "./activeSelection.js";
import { resolveSlotPosition } from "./resolveSlot.js";
import { buildInstructionModalHtml, toDataUrl, CANCEL_SENTINEL } from "./modalHtml.js";
import { composePrompt } from "../agent/prompt.js";
import { writeMcpConfig } from "../agent/mcpConfigFile.js";
import { runClaude } from "../agent/spawnClaude.js";
import { stepMessage } from "../agent/streamEvents.js";
import type { ClaudeResult } from "../agent/resultParser.js";

/** Format elapsed ms as "12s" or "1m05s" for the progress text. */
function formatElapsed(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m${String(total % 60).padStart(2, "0")}s`;
}

export interface AskClaudeDeps {
  context: ableton.ExtensionContext<"1.0.0">;
  token: string;
}

/** Register the "Ask Claude…" Session-cell action and its command handler. */
export async function registerAskClaude(deps: AskClaudeDeps): Promise<void> {
  const { context, token } = deps;
  const commandId = "ableton-mcp.askClaude.clipSlot";

  context.commands.registerCommand(commandId, async (arg: unknown) => {
    try {
      const slot = context.getObjectFromHandle(arg as ableton.Handle, ableton.ClipSlot);
      const selection = captureClipSlot(slot as unknown as ClipSlotLike);

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
            totalScenes: song.scenes.length,
          });
        } else {
          setActiveSelection(null);
        }
      } catch {
        setActiveSelection(null);
      }

      const instruction = await context.ui.showModalDialog(toDataUrl(buildInstructionModalHtml()), 460, 280);
      if (!instruction || instruction === CANCEL_SENTINEL || instruction.trim() === "") {
        return;
      }

      const tmpDir = context.environment.tempDirectory ?? os.tmpdir();
      const configPath = writeMcpConfig({ dir: tmpDir, host: HOST, port: PORT, token, path: MCP_PATH });
      const claudePath = resolveClaudePath({ env: process.env, home: os.homedir(), exists: fs.existsSync });
      const prompt = composePrompt(selection, instruction);

      try {
        let aborted = false;
        const result = await context.ui.withinProgressDialog(
          "Asking Claude…",
          {}, // no progress number → Live's indeterminate "waiting" animation
          async (update, signal) => {
            const startedAt = Date.now();
            let lastStep = "Starting…";
            let rendering = false;
            // Omit the progress arg so the dialog stays in its indeterminate/animated state;
            // the text carries the live step plus elapsed time so long runs visibly tick.
            const render = async (): Promise<void> => {
              if (rendering) return;
              rendering = true;
              try { await update(`${lastStep}  (${formatElapsed(Date.now() - startedAt)})`); }
              catch { /* dialog closed/cancelled */ }
              finally { rendering = false; }
            };
            void render();
            const heartbeat = setInterval(() => void render(), 1000);
            try {
              const r = await runClaude({
                claudePath, prompt, configPath, model: DEFAULT_MODEL,
                allowedTools: ALLOWED_TOOLS, maxTurns: MAX_TURNS, env: process.env, signal,
                onStep: (step) => { lastStep = stepMessage(step); void render(); },
              });
              if (signal.aborted) aborted = true;
              return r;
            } finally {
              clearInterval(heartbeat);
            }
          },
        );

        if (aborted) return; // user cancelled mid-run — no result modal

        const r = result as ClaudeResult;
        const cost = r.costUsd != null ? ` ($${r.costUsd.toFixed(2)}, ${r.numTurns ?? "?"} turns)` : "";
        const body = `<!doctype html><meta charset="utf-8"><body style="font:14px -apple-system,sans-serif;background:#1e1e1e;color:#eee;padding:16px">
        <h3 style="margin:0 0 8px">${r.isError ? "Claude error" : "Claude"}${cost}</h3>
        <pre style="white-space:pre-wrap;word-break:break-word">${r.resultText.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string))}</pre>
        <div style="display:flex;justify-content:flex-end"><button style="padding:8px 16px;border:0;border-radius:6px;background:#3b82f6;color:#fff" onclick="(window.webkit&&window.webkit.messageHandlers.live?window.webkit.messageHandlers.live:window.chrome.webview).postMessage({method:'close_and_send',params:['ok']})">Close</button></div>
        </body>`;
        await context.ui.showModalDialog(toDataUrl(body), 460, 320);
      } finally {
        try { fs.unlinkSync(configPath); } catch { /* best effort */ }
      }
    } catch (e) {
      log.error(`askClaude failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  await context.ui.registerContextMenuAction("ClipSlot", "Ask Claude…", commandId);
  log.info('registered "Ask Claude…" on ClipSlot');
}
