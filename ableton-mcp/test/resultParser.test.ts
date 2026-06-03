import { describe, it, expect } from "vitest";
import { parseClaudeResult } from "../src/agent/resultParser.js";

describe("parseClaudeResult", () => {
  it("extracts result text, cost, turns from a success envelope", () => {
    const stdout = JSON.stringify({
      type: "result", subtype: "success", is_error: false,
      result: "Created a 4-bar clip.", num_turns: 3, total_cost_usd: 0.12,
    });
    const r = parseClaudeResult(stdout);
    expect(r.isError).toBe(false);
    expect(r.resultText).toBe("Created a 4-bar clip.");
    expect(r.numTurns).toBe(3);
    expect(r.costUsd).toBeCloseTo(0.12);
  });
  it("treats unparseable output as an error and preserves the raw text", () => {
    const r = parseClaudeResult("not json at all");
    expect(r.isError).toBe(true);
    expect(r.resultText).toContain("not json at all");
    expect(r.costUsd).toBeNull();
  });
  it("honors an is_error:true envelope", () => {
    const r = parseClaudeResult(JSON.stringify({ is_error: true, result: "Not logged in" }));
    expect(r.isError).toBe(true);
    expect(r.resultText).toBe("Not logged in");
  });
});
