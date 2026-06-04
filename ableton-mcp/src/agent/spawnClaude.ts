import { spawn } from "node:child_process";
import { type ClaudeResult } from "./resultParser.js";
import { parseStreamLine, type StreamStep } from "./streamEvents.js";

export interface ClaudeArgsOptions {
  prompt: string;
  model: string;
  allowedTools: string;
  maxTurns: number;
}

/**
 * Build the headless claude argv. Pure + unit-tested. Never adds a bypass flag.
 * Uses stream-json so progress can be reported live (stream-json requires --verbose in -p mode).
 *
 * The MCP server is NOT passed via `--mcp-config` — on current Claude Code that connects the
 * server but never exposes its tools to the model (the model reports them "not in the deferred
 * tools registry"). It is instead registered with `claude mcp add` (see mcpRegistration.ts) at
 * the same `cwd` this run executes from, which does expose the tools.
 */
export function buildClaudeArgs(opts: ClaudeArgsOptions): string[] {
  return [
    "-p", opts.prompt,
    "--allowedTools", opts.allowedTools,
    "--model", opts.model,
    "--max-turns", String(opts.maxTurns),
    "--output-format", "stream-json",
    "--verbose",
  ];
}

export interface RunClaudeOptions extends ClaudeArgsOptions {
  claudePath: string;
  env: NodeJS.ProcessEnv;
  /** Run from this dir so the local-scope `claude mcp add` registration is picked up. */
  cwd: string;
  signal?: AbortSignal;
  /** Called for each meaningful stream event so the UI can show live progress. */
  onStep?: (step: StreamStep) => void;
}

/**
 * Spawn claude headless, streaming progress via onStep, and resolve the final result.
 * Stdout is NDJSON; we buffer and split on newlines so partial chunks never corrupt a line.
 */
export function runClaude(opts: RunClaudeOptions): Promise<ClaudeResult> {
  return new Promise((resolve) => {
    const child = spawn(opts.claudePath, buildClaudeArgs(opts), {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
      signal: opts.signal,
    });
    let buf = "";
    let err = "";
    let final: ClaudeResult | null = null;

    const handleLine = (line: string): void => {
      const step = parseStreamLine(line);
      if (step == null) return;
      if (step.kind === "result") final = step.result;
      opts.onStep?.(step);
    };

    child.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        handleLine(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    });
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) => {
      resolve({ isError: true, resultText: `spawn failed: ${e.message}`, costUsd: null, numTurns: null });
    });
    child.on("close", () => {
      if (buf.trim().length > 0) handleLine(buf); // flush any trailing line
      resolve(final ?? { isError: true, resultText: err.trim() || "no output", costUsd: null, numTurns: null });
    });
  });
}
