import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadOrCreateToken, verifyAuthHeader } from "../src/server/auth.js";

describe("auth", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ablmcp-"));
  });

  it("creates a token once and reuses it", () => {
    const t1 = loadOrCreateToken(dir);
    const t2 = loadOrCreateToken(dir);
    expect(t1).toHaveLength(64); // 32 bytes hex
    expect(t2).toBe(t1);
  });

  it("accepts the correct bearer header and rejects others", () => {
    const token = loadOrCreateToken(dir);
    expect(verifyAuthHeader(`Bearer ${token}`, token)).toBe(true);
    expect(verifyAuthHeader(`Bearer wrong`, token)).toBe(false);
    expect(verifyAuthHeader(undefined, token)).toBe(false);
    expect(verifyAuthHeader(token, token)).toBe(false); // missing "Bearer " prefix
  });
});
