import * as esbuild from "esbuild";
import * as fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const production = process.argv.includes("--production");

// The Ableton Extension Host's Node runtime omits several globals that bundled
// dependencies (the MCP SDK and its fetch-related deps) reference at MODULE-EVALUATION
// time — notably `global` (e.g. `var GlobalRequest = global.Request;`) and `URL`.
// Our runtime installGlobals() runs too late for those top-level references, so we
// inject the shims as an esbuild banner that executes before any bundled module body.
const GLOBAL_SHIM_BANNER = `"use strict";
(() => {
  const g = globalThis;
  if (typeof g.global === "undefined") g.global = g;
  const nodeUrl = require("node:url");
  if (typeof g.URL === "undefined") g.URL = nodeUrl.URL;
  if (typeof g.URLSearchParams === "undefined") g.URLSearchParams = nodeUrl.URLSearchParams;
  const nodeCrypto = require("node:crypto");
  if (typeof g.crypto === "undefined") g.crypto = nodeCrypto.webcrypto;
  const nodeUtil = require("node:util");
  if (typeof g.TextEncoder === "undefined") g.TextEncoder = nodeUtil.TextEncoder;
  if (typeof g.TextDecoder === "undefined") g.TextDecoder = nodeUtil.TextDecoder;
  const nodeStreamWeb = require("node:stream/web");
  if (typeof g.ReadableStream === "undefined") g.ReadableStream = nodeStreamWeb.ReadableStream;
  if (typeof g.WritableStream === "undefined") g.WritableStream = nodeStreamWeb.WritableStream;
  if (typeof g.TransformStream === "undefined") g.TransformStream = nodeStreamWeb.TransformStream;
  const nodeBuffer = require("node:buffer");
  if (typeof g.Blob === "undefined") g.Blob = nodeBuffer.Blob;
  if (typeof g.File === "undefined") g.File = nodeBuffer.File;
  // Web fetch classes (Request/Response/Headers/fetch) are also stripped from the host.
  // A bundled MCP-SDK fetch wrapper does \`class extends global.Request\` at load time,
  // so these must exist before any module body runs. Sourced from undici (resolved at
  // runtime from node_modules — kept external, not bundled).
  const undici = require("undici");
  if (typeof g.fetch === "undefined") g.fetch = undici.fetch;
  if (typeof g.Headers === "undefined") g.Headers = undici.Headers;
  if (typeof g.Request === "undefined") g.Request = undici.Request;
  if (typeof g.Response === "undefined") g.Response = undici.Response;
  if (typeof g.FormData === "undefined") g.FormData = undici.FormData;
  if (typeof g.WebSocket === "undefined" && undici.WebSocket) g.WebSocket = undici.WebSocket;
})();
`;

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  outfile: manifest.entry,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node22",
  sourcesContent: false,
  logLevel: "info",
  minify: production,
  sourcemap: !production,
  banner: { js: GLOBAL_SHIM_BANNER },
  // node: builtins stay external automatically on platform:node.
});
