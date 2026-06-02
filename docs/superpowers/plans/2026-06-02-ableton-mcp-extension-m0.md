# Ableton MCP Extension — M0 (De-Risk) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the chosen architecture end-to-end: an Ableton Live extension that bundles the official MCP SDK (with injected web-globals), serves MCP over a localhost HTTP server, exposes `tools/list` + one real tool (`get_song_overview`) backed by the live Ableton SDK, and is reachable by Claude — without crashing the Extension Host.

**Architecture:** A single TypeScript extension built with esbuild (CJS/node). On `activate()` it (1) installs missing web globals, (2) installs process-level error guards, (3) initializes the Ableton SDK, (4) starts a `node:http` server on `127.0.0.1:9787`, (5) wires each request to a per-request stateless `StreamableHTTPServerTransport` + `McpServer` whose tools close over the live `context`. A bearer token gates every request.

**Tech Stack:** TypeScript, esbuild, `@ableton-extensions/sdk` (beta tgz), `@ableton-extensions/cli` (beta tgz), `@modelcontextprotocol/sdk`, `zod`, Vitest. Node 24 (Extension Host) / Node 22+ (dev).

**Reference spec:** `docs/superpowers/specs/2026-06-02-ableton-mcp-extension-design.md`

**Live test target:** `/Volumes/ExtData/Applications/Ableton Live 12 Beta.app`
**SDK/CLI tarballs:** `/Volumes/ExtData2/coding/thefck/extensions/ableton-extensions-sdk-1.0.0-beta.0.tgz` and `…/ableton-extensions-cli-1.0.0-beta.0.tgz`

---

## File Structure

All paths are under the project root `/Volumes/ExtData2/coding/thefck/ableton-mcp/`.

| File | Responsibility |
|---|---|
| `package.json` | deps, scripts |
| `tsconfig.json` | TS config |
| `manifest.json` | Ableton extension manifest |
| `build.ts` | esbuild bundle; banner injects global-shim require |
| `vitest.config.ts` | test config |
| `src/extension.ts` | `activate()` — wiring only |
| `src/globals.ts` | install missing web globals (URL, crypto, Headers, streams…) |
| `src/core/errors.ts` | process guards + `withSafeHandler` wrapper |
| `src/core/config.ts` | port, host, paths |
| `src/core/logger.ts` | host-safe logging |
| `src/server/auth.ts` | token generate/load/verify (constant-time) |
| `src/server/httpServer.ts` | `node:http` server + per-request transport + auth |
| `src/mcp/server.ts` | `buildMcpServer(context)` factory + tool registration |
| `src/mcp/tools/song.ts` | `get_song_overview` tool |
| `src/sdk/serialize.ts` | SDK Song → plain JSON snapshot |
| `src/sdk/types.ts` | minimal interfaces for the live `context` (for typing/mocking) |
| `test/*` | unit + integration tests |

---

## Task 1: Project scaffold

**Files:**
- Create: `ableton-mcp/package.json`
- Create: `ableton-mcp/tsconfig.json`
- Create: `ableton-mcp/manifest.json`
- Create: `ableton-mcp/.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ableton-mcp",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/extension.js",
  "scripts": {
    "build": "tsc --noEmit && tsx build.ts",
    "start": "tsx build.ts && extensions-cli run --live \"/Volumes/ExtData/Applications/Ableton Live 12 Beta.app\"",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@ableton-extensions/cli": "file:../extensions/ableton-extensions-cli-1.0.0-beta.0.tgz",
    "@types/node": "^25.2.3",
    "esbuild": "0.28.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "@ableton-extensions/sdk": "file:../extensions/ableton-extensions-sdk-1.0.0-beta.0.tgz",
    "@modelcontextprotocol/sdk": "^1.13.0",
    "zod": "^3.23.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src", "build.ts", "test"]
}
```

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "name": "Ableton MCP",
  "author": "thefck",
  "entry": "dist/extension.js",
  "version": "0.0.1",
  "minimumApiVersion": "1.0.0"
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
*.ablx
```

- [ ] **Step 5: Install dependencies**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npm install`
Expected: installs succeed; `@modelcontextprotocol/sdk` and `zod` resolve. Note the exact installed SDK version printed (used in Task 4 verification).

- [ ] **Step 6: Commit**

```bash
git add ableton-mcp/package.json ableton-mcp/tsconfig.json ableton-mcp/manifest.json ableton-mcp/.gitignore
git commit -m "chore: scaffold ableton-mcp extension project"
```

---

## Task 2: Global shims (the spike's #1 constraint)

The Extension Host omits some web globals (`URL` confirmed missing). Install any that are absent so the bundled MCP SDK runs. In normal Node (tests) these already exist, so the shim is a no-op there.

**Files:**
- Create: `ableton-mcp/src/globals.ts`
- Create: `ableton-mcp/test/globals.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/globals.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ableton-mcp && npx vitest run test/globals.test.ts`
Expected: FAIL — cannot find module `../src/globals.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/globals.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ableton-mcp && npx vitest run test/globals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ableton-mcp/src/globals.ts ableton-mcp/test/globals.test.ts
git commit -m "feat: install missing web globals for the Extension Host"
```

---

## Task 3: Error isolation (the spike's #2 constraint)

An uncaught throw killed the whole host. Provide a handler wrapper that never throws, plus process-level guards that keep the process alive.

**Files:**
- Create: `ableton-mcp/src/core/logger.ts`
- Create: `ableton-mcp/src/core/errors.ts`
- Create: `ableton-mcp/test/errors.test.ts`

- [ ] **Step 1: Create the logger (no test needed — thin wrapper)**

```ts
// src/core/logger.ts
/** Host-safe logging. Never logs secrets. Prefixed for easy grep in Live's log. */
export const log = {
  info: (msg: string, ...rest: unknown[]) => console.log(`[ableton-mcp] ${msg}`, ...rest),
  warn: (msg: string, ...rest: unknown[]) => console.warn(`[ableton-mcp] ${msg}`, ...rest),
  error: (msg: string, ...rest: unknown[]) => console.error(`[ableton-mcp] ${msg}`, ...rest),
};
```

- [ ] **Step 2: Write the failing test for `withSafeHandler`**

```ts
// test/errors.test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ableton-mcp && npx vitest run test/errors.test.ts`
Expected: FAIL — cannot find module `../src/core/errors.js`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/core/errors.ts
import { log } from "./logger.js";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * Wraps a tool handler so it NEVER throws: any error becomes an MCP isError result.
 * `toolName` is used only for logging.
 */
export function withSafeHandler<A extends unknown[]>(
  toolName: string,
  fn: (...args: A) => Promise<ToolResult>,
): (...args: A) => Promise<ToolResult> {
  return async (...args: A): Promise<ToolResult> => {
    try {
      return await fn(...args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`tool "${toolName}" failed: ${message}`);
      return { content: [{ type: "text", text: `Error in ${toolName}: ${message}` }], isError: true };
    }
  };
}

/** Install process-level guards so a stray error can never exit the Extension Host. */
export function installProcessGuards(): void {
  process.on("uncaughtException", (err) => {
    log.error(`uncaughtException (suppressed to keep host alive): ${err?.stack ?? err}`);
  });
  process.on("unhandledRejection", (reason) => {
    log.error(`unhandledRejection (suppressed): ${String(reason)}`);
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ableton-mcp && npx vitest run test/errors.test.ts`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add ableton-mcp/src/core/logger.ts ableton-mcp/src/core/errors.ts ableton-mcp/test/errors.test.ts
git commit -m "feat: error isolation wrapper and process guards"
```

---

## Task 4: SDK type shims + Song serializer + verify MCP SDK imports

We type the slice of the live `context` we use (so handlers and mocks are typed), serialize a Song snapshot, and verify the installed MCP SDK's import paths/API before relying on them.

**Files:**
- Create: `ableton-mcp/src/sdk/types.ts`
- Create: `ableton-mcp/src/sdk/serialize.ts`
- Create: `ableton-mcp/test/serialize.test.ts`

- [ ] **Step 1: Verify MCP SDK import paths (smoke check — pins the API we code against)**

Run:
```bash
cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && node --input-type=module -e "
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
const s = new McpServer({ name: 'probe', version: '0.0.0' });
console.log('registerTool:', typeof s.registerTool);
console.log('connect:', typeof s.connect);
const t = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
console.log('handleRequest:', typeof t.handleRequest);
"
```
Expected: prints `registerTool: function`, `connect: function`, `handleRequest: function`.
If any import path differs in the installed version, STOP and adjust the import paths used in Task 5/6 to match (e.g. a different subpath), then re-run this check. Do not proceed on a guessed API.

- [ ] **Step 2: Create the SDK type slice**

```ts
// src/sdk/types.ts
/** Minimal structural types for the live Ableton context we depend on in M0.
 *  Kept structural so tests can supply plain-object mocks. */
export interface LiveTrack {
  readonly name: string;
}

export interface LiveScene {
  readonly name: string;
}

export interface LiveSong {
  readonly tempo: number;
  readonly tracks: ReadonlyArray<LiveTrack>;
  readonly returnTracks: ReadonlyArray<LiveTrack>;
  readonly scenes: ReadonlyArray<LiveScene>;
  readonly rootNote: number;
  readonly scaleName: string;
}

export interface LiveApplication {
  readonly song: LiveSong;
}

/** The subset of ableton.ExtensionContext M0 uses. */
export interface LiveContext {
  readonly application: LiveApplication;
}
```

- [ ] **Step 3: Write the failing test for the serializer**

```ts
// test/serialize.test.ts
import { describe, it, expect } from "vitest";
import { serializeSongOverview } from "../src/sdk/serialize.js";
import type { LiveContext } from "../src/sdk/types.js";

function fakeContext(): LiveContext {
  return {
    application: {
      song: {
        tempo: 120,
        tracks: [{ name: "Drums" }, { name: "Bass" }],
        returnTracks: [{ name: "A-Reverb" }],
        scenes: [{ name: "Intro" }, { name: "Verse" }],
        rootNote: 0,
        scaleName: "Major",
      },
    },
  };
}

describe("serializeSongOverview", () => {
  it("produces a plain JSON snapshot of the song", () => {
    const snap = serializeSongOverview(fakeContext());
    expect(snap).toEqual({
      tempo: 120,
      trackCount: 2,
      trackNames: ["Drums", "Bass"],
      returnTrackNames: ["A-Reverb"],
      sceneCount: 2,
      sceneNames: ["Intro", "Verse"],
      rootNote: 0,
      scaleName: "Major",
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd ableton-mcp && npx vitest run test/serialize.test.ts`
Expected: FAIL — cannot find module `../src/sdk/serialize.js`.

- [ ] **Step 5: Write minimal implementation**

```ts
// src/sdk/serialize.ts
import type { LiveContext } from "./types.js";

export interface SongOverview {
  tempo: number;
  trackCount: number;
  trackNames: string[];
  returnTrackNames: string[];
  sceneCount: number;
  sceneNames: string[];
  rootNote: number;
  scaleName: string;
}

/** Read the live song into an immutable plain-object snapshot (no SDK handles leak out). */
export function serializeSongOverview(context: LiveContext): SongOverview {
  const song = context.application.song;
  return {
    tempo: song.tempo,
    trackCount: song.tracks.length,
    trackNames: song.tracks.map((t) => t.name),
    returnTrackNames: song.returnTracks.map((t) => t.name),
    sceneCount: song.scenes.length,
    sceneNames: song.scenes.map((s) => s.name),
    rootNote: song.rootNote,
    scaleName: song.scaleName,
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd ableton-mcp && npx vitest run test/serialize.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add ableton-mcp/src/sdk/types.ts ableton-mcp/src/sdk/serialize.ts ableton-mcp/test/serialize.test.ts
git commit -m "feat: song overview serializer + sdk type slice"
```

---

## Task 5: MCP server factory + `get_song_overview` tool

Build an `McpServer` whose tools close over the live `context`. The M0 tool takes **no input** (avoids cross-version input-schema differences). Verified by an in-process MCP client round-trip.

**Files:**
- Create: `ableton-mcp/src/mcp/tools/song.ts`
- Create: `ableton-mcp/src/mcp/server.ts`
- Create: `ableton-mcp/test/mcp-roundtrip.test.ts`

- [ ] **Step 1: Create the song tool registration**

```ts
// src/mcp/tools/song.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiveContext } from "../../sdk/types.js";
import { serializeSongOverview } from "../../sdk/serialize.js";
import { withSafeHandler } from "../../core/errors.js";

export function registerSongTools(server: McpServer, context: LiveContext): void {
  server.registerTool(
    "get_song_overview",
    {
      title: "Get song overview",
      description:
        "Returns a snapshot of the current Live set: tempo, track names, return tracks, scenes, and the current scale.",
    },
    withSafeHandler("get_song_overview", async () => {
      const overview = serializeSongOverview(context);
      return { content: [{ type: "text", text: JSON.stringify(overview, null, 2) }] };
    }),
  );
}
```

- [ ] **Step 2: Create the server factory**

```ts
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiveContext } from "../sdk/types.js";
import { registerSongTools } from "./tools/song.js";

/** Build a fresh McpServer with all tools registered, closed over the live context. */
export function buildMcpServer(context: LiveContext): McpServer {
  const server = new McpServer({ name: "ableton-mcp", version: "0.0.1" });
  registerSongTools(server, context);
  return server;
}
```

- [ ] **Step 3: Write the failing in-process round-trip test**

```ts
// test/mcp-roundtrip.test.ts
import { describe, it, expect } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { buildMcpServer } from "../src/mcp/server.js";
import type { LiveContext } from "../src/sdk/types.js";

function fakeContext(): LiveContext {
  return {
    application: {
      song: {
        tempo: 97,
        tracks: [{ name: "Marimba" }, { name: "Bass" }],
        returnTracks: [],
        scenes: [{ name: "A" }],
        rootNote: 2,
        scaleName: "Dorian",
      },
    },
  };
}

describe("MCP round-trip", () => {
  it("lists tools and calls get_song_overview", async () => {
    const server = buildMcpServer(fakeContext());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain("get_song_overview");

    const result = await client.callTool({ name: "get_song_overview", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.tempo).toBe(97);
    expect(parsed.trackNames).toEqual(["Marimba", "Bass"]);
    expect(parsed.scaleName).toBe("Dorian");

    await client.close();
    await server.close();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd ableton-mcp && npx vitest run test/mcp-roundtrip.test.ts`
Expected: FAIL — modules not found (`../src/mcp/server.js`).
(If the `InMemoryTransport`/`Client` import subpaths differ in the installed SDK version, fix them per the Task 4 Step 1 verification approach: `node -e` probe the path, then correct the import.)

- [ ] **Step 5: Make it pass**

The implementation already exists from Steps 1–2. Re-run:

Run: `cd ableton-mcp && npx vitest run test/mcp-roundtrip.test.ts`
Expected: PASS — tool listed and called, snapshot fields correct.

- [ ] **Step 6: Commit**

```bash
git add ableton-mcp/src/mcp/tools/song.ts ableton-mcp/src/mcp/server.ts ableton-mcp/test/mcp-roundtrip.test.ts
git commit -m "feat: MCP server factory and get_song_overview tool"
```

---

## Task 6: Auth — bearer token

**Files:**
- Create: `ableton-mcp/src/core/config.ts`
- Create: `ableton-mcp/src/server/auth.ts`
- Create: `ableton-mcp/test/auth.test.ts`

- [ ] **Step 1: Create config**

```ts
// src/core/config.ts
import * as path from "node:path";
import * as os from "node:os";

export const HOST = "127.0.0.1";
export const PORT = Number(process.env.ABLETON_MCP_PORT ?? 9787);
export const MCP_PATH = "/mcp";

/** Where the bearer token is persisted. Prefers the SDK storage dir; falls back to tmp. */
export function tokenFilePath(storageDirectory: string | undefined): string {
  const dir = storageDirectory ?? os.tmpdir();
  return path.join(dir, "ableton-mcp-token");
}
```

- [ ] **Step 2: Write the failing test**

```ts
// test/auth.test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ableton-mcp && npx vitest run test/auth.test.ts`
Expected: FAIL — cannot find module `../src/server/auth.js`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/server/auth.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ableton-mcp && npx vitest run test/auth.test.ts`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add ableton-mcp/src/core/config.ts ableton-mcp/src/server/auth.ts ableton-mcp/test/auth.test.ts
git commit -m "feat: bearer token auth"
```

---

## Task 7: HTTP server + stateless transport wiring

Bind `node:http` on `127.0.0.1:PORT`. For each request: check auth → read body → create a per-request stateless `StreamableHTTPServerTransport` + `McpServer` → `handleRequest`. Tested end-to-end with the real MCP HTTP **client** over a loopback socket.

**Files:**
- Create: `ableton-mcp/src/server/httpServer.ts`
- Create: `ableton-mcp/test/httpServer.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
// test/httpServer.test.ts
import { describe, it, expect, afterEach } from "vitest";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startHttpServer } from "../src/server/httpServer.js";
import type { LiveContext } from "../src/sdk/types.js";

function fakeContext(): LiveContext {
  return {
    application: {
      song: {
        tempo: 140,
        tracks: [{ name: "Lead" }],
        returnTracks: [],
        scenes: [],
        rootNote: 0,
        scaleName: "Minor",
      },
    },
  };
}

let server: Server | undefined;
const TOKEN = "a".repeat(64);

afterEach(async () => {
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  server = undefined;
});

describe("httpServer", () => {
  it("serves MCP over http on an ephemeral port with auth", async () => {
    const started = await startHttpServer({ context: fakeContext(), token: TOKEN, host: "127.0.0.1", port: 0 });
    server = started.server;
    const url = new URL(`http://127.0.0.1:${started.port}/mcp`);

    const client = new Client({ name: "it", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
    });
    await client.connect(transport);

    const result = await client.callTool({ name: "get_song_overview", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(JSON.parse(text).tempo).toBe(140);

    await client.close();
  });

  it("rejects requests without the bearer token (401)", async () => {
    const started = await startHttpServer({ context: fakeContext(), token: TOKEN, host: "127.0.0.1", port: 0 });
    server = started.server;
    const res = await fetch(`http://127.0.0.1:${started.port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ableton-mcp && npx vitest run test/httpServer.test.ts`
Expected: FAIL — cannot find module `../src/server/httpServer.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/server/httpServer.ts
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "../mcp/server.js";
import { verifyAuthHeader } from "./auth.js";
import { MCP_PATH } from "../core/config.js";
import { log } from "../core/logger.js";
import type { LiveContext } from "../sdk/types.js";

export interface StartHttpOptions {
  context: LiveContext;
  token: string;
  host: string;
  port: number;
}

export interface StartedHttp {
  server: Server;
  port: number;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Start the MCP HTTP server. Resolves once listening; `port` is the actual bound port. */
export function startHttpServer(opts: StartHttpOptions): Promise<StartedHttp> {
  const server = createServer((req, res) => {
    // All request handling is guarded — an error here must never crash the host.
    void (async () => {
      try {
        const url = new URL(req.url ?? "/", `http://${opts.host}`);
        if (url.pathname !== MCP_PATH) {
          sendJson(res, 404, { error: "not found" });
          return;
        }
        if (!verifyAuthHeader(req.headers["authorization"], opts.token)) {
          sendJson(res, 401, { error: "unauthorized" });
          return;
        }

        const body = req.method === "POST" ? await readBody(req) : undefined;

        // Stateless: a fresh transport + server per request.
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        const mcp = buildMcpServer(opts.context);
        res.on("close", () => {
          void transport.close();
          void mcp.close();
        });
        await mcp.connect(transport);
        await transport.handleRequest(req, res, body);
      } catch (err) {
        log.error(`http handler error: ${err instanceof Error ? err.message : String(err)}`);
        if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
      }
    })();
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      log.error(`port ${opts.port} already in use — is another Live/extension instance running?`);
    } else {
      log.error(`server error: ${err.message}`);
    }
  });

  return new Promise<StartedHttp>((resolve) => {
    server.listen(opts.port, opts.host, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : opts.port;
      resolve({ server, port });
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ableton-mcp && npx vitest run test/httpServer.test.ts`
Expected: PASS — MCP client round-trips tool call (tempo 140), and the no-token request returns 401.
(If `StreamableHTTPClientTransport` requires a different accept handshake in the installed version and the 401 test sees a different status for missing auth, keep the auth gate ahead of transport handling so unauthorized requests still short-circuit to 401 — adjust the test's expected status only if the SDK demands a specific pre-flight.)

- [ ] **Step 5: Commit**

```bash
git add ableton-mcp/src/server/httpServer.ts ableton-mcp/test/httpServer.test.ts
git commit -m "feat: localhost MCP http server with stateless transport"
```

---

## Task 8: Extension entry + esbuild banner

Wire everything in `activate()`, and configure esbuild so globals are installed before any bundled module (including the MCP SDK) runs.

**Files:**
- Create: `ableton-mcp/src/extension.ts`
- Create: `ableton-mcp/build.ts`
- Create: `ableton-mcp/vitest.config.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Create the extension entry**

```ts
// src/extension.ts
import { installGlobals } from "./globals.js";
// Globals MUST be installed before anything that may touch web globals at import time.
installGlobals();

import * as ableton from "@ableton-extensions/sdk";
import { installProcessGuards } from "./core/errors.js";
import { startHttpServer } from "./server/httpServer.js";
import { loadOrCreateToken } from "./server/auth.js";
import { HOST, PORT, MCP_PATH } from "./core/config.js";
import { log } from "./core/logger.js";
import type { LiveContext } from "./sdk/types.js";

export function activate(activation: ableton.ActivationContext): void {
  installProcessGuards();

  let context: ableton.ExtensionContext<"1.0.0">;
  try {
    context = ableton.initialize(activation, "1.0.0");
  } catch (err) {
    log.error(`SDK initialize failed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const storageDir = context.environment.storageDirectory;
  const token = loadOrCreateToken(storageDir);

  // The SDK ExtensionContext structurally satisfies LiveContext for the fields we use.
  const liveContext = context as unknown as LiveContext;

  startHttpServer({ context: liveContext, token, host: HOST, port: PORT })
    .then(({ port }) => {
      log.info(`MCP server listening on http://${HOST}:${port}${MCP_PATH}`);
      log.info(
        `Connect Claude with:\n  claude mcp add --transport http ableton ` +
          `http://${HOST}:${port}${MCP_PATH} --header "Authorization: Bearer ${token}"`,
      );
    })
    .catch((err) => log.error(`failed to start MCP server: ${String(err)}`));
}
```

- [ ] **Step 3: Create `build.ts` (banner installs globals before the bundle body)**

```ts
// build.ts
import * as esbuild from "esbuild";
import * as fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const production = process.argv.includes("--production");

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
  // node: builtins stay external automatically on platform:node.
});
```

- [ ] **Step 4: Typecheck + build**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npm run build`
Expected: `tsc --noEmit` passes (no type errors) and esbuild writes `dist/extension.js`.

- [ ] **Step 5: Confirm node builtins stayed external in the bundle**

Run: `cd ableton-mcp && grep -c 'require("node:' dist/extension.js`
Expected: a count ≥ 1 (e.g. `node:http`, `node:url`, `node:crypto` appear as external requires, not inlined).

- [ ] **Step 6: Run the full unit/integration suite**

Run: `cd ableton-mcp && npx vitest run`
Expected: all tests from Tasks 2–7 PASS.

- [ ] **Step 7: Commit**

```bash
git add ableton-mcp/src/extension.ts ableton-mcp/build.ts ableton-mcp/vitest.config.ts
git commit -m "feat: extension entry wiring and esbuild config"
```

---

## Task 9: Live E2E — prove it in Ableton with Claude connected

This is the M0 gate. Manual/scripted verification in the real Extension Host.

**Files:** none (verification task).

- [ ] **Step 1: Ensure Ableton Live 12 Beta is running**

Run: `open "/Volumes/ExtData/Applications/Ableton Live 12 Beta.app"` (dismiss any startup dialog so the host can connect).

- [ ] **Step 2: Build and launch the extension host**

Run:
```bash
cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH"
npm run build
npx extensions-cli run --live "/Volumes/ExtData/Applications/Ableton Live 12 Beta.app" 2>&1 | tee /tmp/ableton-mcp-run.log &
```
Expected within ~10s: log shows `activate() ... MCP server listening on http://127.0.0.1:9787/mcp` and a `claude mcp add ...` line containing the token.

- [ ] **Step 3: Capture the token**

Run: `grep -o 'Bearer [a-f0-9]\{64\}' /tmp/ableton-mcp-run.log | head -1`
Expected: prints `Bearer <64-hex>`. Save the hex as `$TOKEN` for the next step.

- [ ] **Step 4: Raw protocol smoke (no Claude yet) — list tools over http**

Run:
```bash
TOKEN=$(grep -o 'Bearer [a-f0-9]\{64\}' /tmp/ableton-mcp-run.log | head -1 | awk '{print $2}')
curl -s -X POST http://127.0.0.1:9787/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
Expected: a JSON (or SSE `data:` framed) response whose result lists `get_song_overview`.

- [ ] **Step 5: Call the tool against the live set**

Run:
```bash
curl -s -X POST http://127.0.0.1:9787/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_song_overview","arguments":{}}}'
```
Expected: result text is the JSON snapshot of the **currently open Live set** (real tempo, real track names).

- [ ] **Step 6: Confirm an unauthorized request is rejected**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:9787/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{}}'
```
Expected: `401`.

- [ ] **Step 7: Connect Claude Code as an MCP client**

Run:
```bash
TOKEN=$(grep -o 'Bearer [a-f0-9]\{64\}' /tmp/ableton-mcp-run.log | head -1 | awk '{print $2}')
claude mcp add --transport http ableton http://127.0.0.1:9787/mcp --header "Authorization: Bearer $TOKEN"
claude mcp list
```
Expected: `ableton` appears and shows as connected/reachable.

- [ ] **Step 8: Confirm host stability**

Run: `lsof -nP -iTCP:9787 | grep LISTEN`
Expected: still LISTENING after all the above calls (no crash — the spike's #2 constraint held).

- [ ] **Step 9: Record the result in the spec**

Append an "M0 verified (date)" note to `docs/superpowers/specs/2026-06-02-ableton-mcp-extension-design.md` summarizing what passed, then commit:

```bash
git add docs/superpowers/specs/2026-06-02-ableton-mcp-extension-design.md
git commit -m "docs: record M0 live verification"
```

---

## Self-Review

**Spec coverage (M0 scope):**
- Localhost HTTP MCP server inside the extension → Tasks 7, 8, 9 ✅
- Official MCP SDK + global shims → Tasks 2, 5, 8 ✅
- Error isolation (no host crash) → Task 3 + guarded http handler in Task 7 + Task 9 Step 8 ✅
- Bearer-token security, 127.0.0.1 only → Task 6, Task 7, Task 9 Steps 6–7 ✅
- `get_song_overview` backed by live SDK → Tasks 4, 5, 9 ✅
- Claude connectivity → Task 9 Step 7 ✅
- Port default 9787 + override → `src/core/config.ts` (Task 6) ✅
- (M1–M5 intentionally out of scope; separate plans.)

**Placeholder scan:** No TBD/TODO; every code step has complete code; every run step has an exact command + expected output. The Task 4/5/7 notes about adjusting import paths are *conditional verification instructions tied to a concrete probe*, not deferred work.

**Type consistency:** `LiveContext`/`LiveSong` (Task 4) are consumed identically in `serialize.ts` (Task 4), `song.ts`/`server.ts` (Task 5), `httpServer.ts` (Task 7), `extension.ts` (Task 8). `withSafeHandler` signature (Task 3) matches its use in `song.ts` (Task 5). `startHttpServer` options/return (Task 7) match the call in `extension.ts` (Task 8). `loadOrCreateToken`/`verifyAuthHeader` (Task 6) match uses in Task 7/8. Tool name `get_song_overview` is identical across Tasks 5, 7, 9.
