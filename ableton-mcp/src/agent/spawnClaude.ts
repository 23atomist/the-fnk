import { spawn } from "node:child_process";
import { parseClaudeResult, type ClaudeResult } from "./resultParser.js";

export interface ClaudeArgsOptions {
  prompt: string;
  configPath: string;
  model: string;
  allowedTools: string;
  maxTurns: number;
}

/** Build the headless claude argv. Pure + unit-tested. Never adds a bypass flag. */
export function buildClaudeArgs(opts: ClaudeArgsOptions): string[] {
  return [
    "-p", opts.prompt,
    "--mcp-config", opts.configPath,
    "--strict-mcp-config",
    "--allowedTools", opts.allowedTools,
    "--model", opts.model,
    "--max-turns", String(opts.maxTurns),
    "--output-format", "json",
  ];
}

export interface RunClaudeOptions extends ClaudeArgsOptions {
  claudePath: string;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

/** Spawn claude headless and resolve a parsed result. Verified at the live gate. */
export function runClaude(opts: RunClaudeOptions): Promise<ClaudeResult> {
  return new Promise((resolve) => {
    const child = spawn(opts.claudePath, buildClaudeArgs(opts), {
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
      signal: opts.signal,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) => {
      resolve({ isError: true, resultText: `spawn failed: ${e.message}`, costUsd: null, numTurns: null });
    });
    child.on("close", () => {
      resolve(out.trim().length > 0 ? parseClaudeResult(out) : { isError: true, resultText: err.trim() || "no output", costUsd: null, numTurns: null });
    });
  });
}
