import { spawn } from "node:child_process";

/**
 * Registering the extension's MCP server in Claude's config (`claude mcp add`) is the only
 * spawn method that reliably exposes the tools to a headless `claude -p` run on current
 * Claude Code — passing `--mcp-config <file> --strict-mcp-config` connects the server but
 * never surfaces its tools to the model. We register at a fixed `cwd` with **local** scope
 * and run `claude -p` from the same `cwd`, so the ephemeral entry is isolated to that dir
 * and cleaned up after the run.
 */
export interface McpRegistrationOptions {
  name: string;
  url: string;
  token: string;
}

/** Pure: argv for `claude mcp add` of our HTTP server (local scope). Unit-tested. */
export function buildMcpAddArgs(opts: McpRegistrationOptions): string[] {
  return [
    "mcp", "add",
    "--transport", "http",
    opts.name, opts.url,
    "--header", `Authorization: Bearer ${opts.token}`,
    "--scope", "local",
  ];
}

/** Pure: argv for `claude mcp remove` (local scope). Unit-tested. */
export function buildMcpRemoveArgs(name: string): string[] {
  return ["mcp", "remove", "--scope", "local", name];
}

interface RunCliOptions {
  claudePath: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

/** Run a `claude` subcommand to completion, resolving its exit code (never throws). */
function runClaudeCli(args: string[], opts: RunCliOptions): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(opts.claudePath, args, { cwd: opts.cwd, env: opts.env, stdio: "ignore" });
    child.on("error", () => resolve(-1));
    child.on("close", (code) => resolve(code ?? -1));
  });
}

/**
 * Register the server fresh: remove any stale entry of the same name first (ignored if
 * absent), then add. Idempotent across runs.
 */
export async function registerMcpServer(reg: McpRegistrationOptions, run: RunCliOptions): Promise<void> {
  await runClaudeCli(buildMcpRemoveArgs(reg.name), run);
  await runClaudeCli(buildMcpAddArgs(reg), run);
}

/** Remove the server entry. Best-effort; safe to call even if it was never added. */
export async function unregisterMcpServer(name: string, run: RunCliOptions): Promise<void> {
  await runClaudeCli(buildMcpRemoveArgs(name), run);
}
