import { describe, it, expect } from "vitest";
import { withSafeHandler } from "../src/core/errors.js";

describe("withSafeHandler", () => {
  it("returns the handler result on success", async () => {
    const safe = withSafeHandler("ok_tool", async (x: number) => ({
      content: [{ type: "text" as const, text: String(x * 2) }],
    }));
    const res = await safe(21);
    expect(res.isError).toBeUndefined();
    expect(res.content[0]).toEqual({ type: "text", text: "42" });
  });

  it("converts a thrown error into an MCP isError result instead of throwing", async () => {
    const safe = withSafeHandler("boom_tool", async () => {
      throw new Error("kaboom");
    });
    const res = await safe(undefined);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("kaboom");
  });
});
