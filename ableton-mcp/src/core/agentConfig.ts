export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const ALLOWED_TOOLS = "mcp__ableton__*";
export const MAX_TURNS = 12;

export interface ResolveClaudeOptions {
  env: NodeJS.ProcessEnv;
  home: string;
  exists: (path: string) => boolean;
}

/** Find the claude CLI: explicit override → ~/.local/bin/claude → bare "claude" (PATH). */
export function resolveClaudePath(opts: ResolveClaudeOptions): string {
  const configured = opts.env.ABLETON_MCP_CLAUDE_PATH;
  if (configured && opts.exists(configured)) return configured;
  const local = `${opts.home}/.local/bin/claude`;
  if (opts.exists(local)) return local;
  return "claude";
}
