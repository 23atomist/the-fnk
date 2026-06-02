import * as fs from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { tokenFilePath } from "../core/config.js";

/** Load the persisted token, or generate + persist a new one (0600). */
export function loadOrCreateToken(storageDirectory: string | undefined): string {
  const file = tokenFilePath(storageDirectory);
  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    if (existing.length > 0) return existing;
  } catch {
    // not created yet
  }
  const token = randomBytes(32).toString("hex");
  fs.writeFileSync(file, token, { mode: 0o600 });
  return token;
}

/** Constant-time check of an `Authorization: Bearer <token>` header. */
export function verifyAuthHeader(header: string | undefined, expected: string): boolean {
  if (!header || !header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
