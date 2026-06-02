import { log } from "./logger.js";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Wraps a tool handler so it NEVER throws: any error becomes an MCP isError result.
 * `toolName` is used only for logging.
 */
export function withSafeHandler<A extends unknown[]>(
  toolName: string,
  fn: (...args: A) => Promise<ToolResult>,
): (...args: A) => Promise<ToolResult> {
  return async (...args: A): Promise<ToolResult> => {
    try {
      return await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`tool "${toolName}" failed: ${message}`);
      return { content: [{ type: "text", text: `Error in ${toolName}: ${message}` }], isError: true };
    }
  };
}

/** Install process-level guards so a stray error can never exit the Extension Host. */
export function installProcessGuards(): void {
  process.on("uncaughtException", (err) => {
    log.error(`uncaughtException (suppressed to keep host alive): ${err?.stack ?? err}`);
  });
  process.on("unhandledRejection", (reason) => {
    log.error(`unhandledRejection (suppressed): ${String(reason)}`);
  });
}
