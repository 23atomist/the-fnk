import { describe, it, expect } from "vitest";
import { resolveClaudePath, DEFAULT_MODEL, ALLOWED_TOOLS, MAX_TURNS } from "../src/core/agentConfig.js";

describe("resolveClaudePath", () => {
  const home = "/Users/x";
  it("prefers an explicit env override when it exists", () => {
    const p = resolveClaudePath({
      env: { ABLETON_MCP_CLAUDE_PATH: "/opt/claude" },
      home,
      exists: (q) => q === "/opt/claude",
    });
    expect(p).toBe("/opt/claude");
  });
  it("falls back to ~/.local/bin/claude when present", () => {
    const p = resolveClaudePath({ env: {}, home, exists: (q) => q === "/Users/x/.local/bin/claude" });
    expect(p).toBe("/Users/x/.local/bin/claude");
  });
  it("falls back to bare 'claude' (PATH) when nothing else exists", () => {
    const p = resolveClaudePath({ env: {}, home, exists: () => false });
    expect(p).toBe("claude");
  });
});

describe("defaults", () => {
  it("uses sonnet, ableton-scoped tools, and a bounded max-turns", () => {
    expect(DEFAULT_MODEL).toBe("claude-sonnet-4-6");
    expect(ALLOWED_TOOLS).toBe("mcp__ableton__*");
    expect(MAX_TURNS).toBeGreaterThan(0);
  });
});
