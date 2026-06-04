import { describe, it, expect } from "vitest";
import { buildMcpAddArgs, buildMcpRemoveArgs } from "../src/agent/mcpRegistration.js";

describe("buildMcpAddArgs", () => {
  it("registers an HTTP server with bearer auth at local scope", () => {
    const args = buildMcpAddArgs({
      name: "ableton",
      url: "http://127.0.0.1:9787/mcp",
      token: "t0ken",
    });
    expect(args).toEqual([
      "mcp", "add",
      "--transport", "http",
      "ableton", "http://127.0.0.1:9787/mcp",
      "--header", "Authorization: Bearer t0ken",
      "--scope", "local",
    ]);
  });
});

describe("buildMcpRemoveArgs", () => {
  it("removes the named server at local scope", () => {
    expect(buildMcpRemoveArgs("ableton")).toEqual(["mcp", "remove", "--scope", "local", "ableton"]);
  });
});
