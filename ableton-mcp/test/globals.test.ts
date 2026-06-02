import { describe, it, expect } from "vitest";
import { installGlobals, missingGlobalNames } from "../src/globals.js";

describe("installGlobals", () => {
  it("reports nothing missing after install on a host that lacks URL", () => {
    // Simulate a restricted host by deleting URL from a fake global object.
    const fakeGlobal: Record<string, unknown> = { ...globalThis };
    delete (fakeGlobal as { URL?: unknown }).URL;
    installGlobals(fakeGlobal);
    expect(fakeGlobal.URL).toBeTypeOf("function");
    expect(missingGlobalNames(fakeGlobal)).toEqual([]);
  });
});
