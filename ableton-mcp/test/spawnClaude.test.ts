import { describe, it, expect } from "vitest";
import { buildClaudeArgs } from "../src/agent/spawnClaude.js";

describe("buildClaudeArgs", () => {
  it("assembles headless flags with config, allowlist, model, max-turns and json output", () => {
    const args = buildClaudeArgs({
      prompt: "do the thing",
      configPath: "/tmp/c.json",
      model: "claude-sonnet-4-6",
      allowedTools: "mcp__ableton__*",
      maxTurns: 12,
    });
    expect(args).toEqual([
      "-p", "do the thing",
      "--mcp-config", "/tmp/c.json",
      "--strict-mcp-config",
      "--allowedTools", "mcp__ableton__*",
      "--model", "claude-sonnet-4-6",
      "--max-turns", "12",
      "--output-format", "json",
    ]);
  });
  it("never includes a bypass-permissions flag", () => {
    const args = buildClaudeArgs({ prompt: "x", configPath: "/c", model: "m", allowedTools: "a", maxTurns: 1 });
    expect(args.join(" ")).not.toContain("bypassPermissions");
    expect(args.join(" ")).not.toContain("--dangerously");
  });
});
