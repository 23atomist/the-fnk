import { URL, URLSearchParams } from "node:url";
import { webcrypto } from "node:crypto";
import { TextEncoder, TextDecoder } from "node:util";
import {
  ReadableStream,
  WritableStream,
  TransformStream,
} from "node:stream/web";

type AnyGlobal = Record<string, unknown>;

/** Web globals the MCP SDK may reference but the Extension Host may not expose. */
const SHIMS: Record<string, unknown> = {
  URL,
  URLSearchParams,
  crypto: webcrypto,
  TextEncoder,
  TextDecoder,
  ReadableStream,
  WritableStream,
  TransformStream,
};

const REQUIRED = Object.keys(SHIMS);

/** Names from REQUIRED that are still undefined on the given global object. */
export function missingGlobalNames(g: AnyGlobal = globalThis as AnyGlobal): string[] {
  return REQUIRED.filter((name) => typeof g[name] === "undefined");
}

/** Install any missing web globals. Idempotent; a no-op for globals already present. */
export function installGlobals(g: AnyGlobal = globalThis as AnyGlobal): void {
  for (const name of REQUIRED) {
    if (typeof g[name] === "undefined") {
      g[name] = SHIMS[name];
    }
  }
}
