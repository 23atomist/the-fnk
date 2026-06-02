/** Host-safe logging. Never logs secrets. Prefixed for easy grep in Live's log. */
export const log = {
  info: (msg: string, ...rest: unknown[]) => console.log("[ableton-mcp]", msg, ...rest),
  warn: (msg: string, ...rest: unknown[]) => console.warn("[ableton-mcp]", msg, ...rest),
  error: (msg: string, ...rest: unknown[]) => console.error("[ableton-mcp]", msg, ...rest),
};
