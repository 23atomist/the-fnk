import { describe, it, expect } from "vitest";
import { buildClaudeArgs } from "../src/agent/spawnClaude.js";

describe("buildClaudeArgs", () => {
  it("assembles headless flags with allowlist, model, max-turns and streaming output", () => {
    const args = buildClaudeArgs({
      prompt: "do the thing",
      model: "claude-sonnet-4-6",
      allowedTools: "mcp__ableton__*",
      maxTurns: 12,
    });
    expect(args).toEqual([
      "-p", "do the thing",
      "--allowedTools", "mcp__ableton__*",
      "--model", "claude-sonnet-4-6",
      "--max-turns", "12",
      "--output-format", "stream-json",
      "--verbose",
    ]);
  });
  it("does NOT pass --mcp-config (the server is registered via `claude mcp add` instead)", () => {
    const args = buildClaudeArgs({ prompt: "x", model: "m", allowedTools: "a", maxTurns: 1 });
    expect(args.join(" ")).not.toContain("--mcp-config");
    expect(args.join(" ")).not.toContain("--strict-mcp-config");
  });
  it("never includes a bypass-permissions flag", () => {
    const args = buildClaudeArgs({ prompt: "x", model: "m", allowedTools: "a", maxTurns: 1 });
    expect(args.join(" ")).not.toContain("bypassPermissions");
    expect(args.join(" ")).not.toContain("--dangerously");
  });
});
