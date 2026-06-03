import { installGlobals } from "./globals.js";
// Globals MUST be installed before anything that may touch web globals at import time.
installGlobals();

import * as ableton from "@ableton-extensions/sdk";
import { installProcessGuards } from "./core/errors.js";
import { startHttpServer } from "./server/httpServer.js";
import { loadOrCreateToken } from "./server/auth.js";
import { HOST, PORT, MCP_PATH } from "./core/config.js";
import { log } from "./core/logger.js";
import { registerAskClaude } from "./selection/askClaude.js";

export function activate(activation: ableton.ActivationContext): void {
  installProcessGuards();

  let context: ableton.ExtensionContext<"1.0.0">;
  try {
    context = ableton.initialize(activation, "1.0.0");
  } catch (err) {
    log.error(`SDK initialize failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const storageDir = context.environment.storageDirectory;
  const token = loadOrCreateToken(storageDir);

  const candidate = context as { application?: { song?: unknown } };
  if (!candidate.application || !candidate.application.song) {
    log.error("SDK ExtensionContext is missing .application.song — incompatible SDK version?");
    return;
  }

  startHttpServer({ context, token, host: HOST, port: PORT })
    .then(({ port }) => {
      log.info(`MCP server listening on http://${HOST}:${port}${MCP_PATH}`);
      log.info(
        `Connect Claude with:\n  claude mcp add --transport http ableton ` +
          `http://${HOST}:${port}${MCP_PATH} --header "Authorization: Bearer ${token}"`,
      );
      // Register the selection-driven "Ask Claude…" action now that the server (and token) are live.
      void registerAskClaude({ context, token }).catch((e) =>
        log.error(`failed to register Ask Claude: ${String(e)}`),
      );
    })
    .catch((err) => log.error(`failed to start MCP server: ${String(err)}`));
}
