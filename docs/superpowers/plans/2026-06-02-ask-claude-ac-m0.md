# "Ask Claude" AC-M0 (De-Risk) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the selection-driven agent loop inside the real extension: right-click a Session clip slot → "Ask Claude…" → a modal text box returns the typed instruction → the host spawns the `claude` CLI headless against our own Ableton MCP server → its result (and cost) is shown back in Live — without crashing the host.

**Architecture:** Build on M0 (`ableton-mcp/`, on `main`). Add pure, unit-tested helpers (claude-path resolution, prompt composition, modal HTML, temp MCP-config writer, result parser, clip-slot capture) plus thin host-integration glue (`showModalDialog`, context-menu registration, `child_process` spawn) wired in `activate()`. The glue is verified at the live gate, not in unit tests.

**Tech Stack:** TypeScript, esbuild, `@ableton-extensions/sdk`, `@modelcontextprotocol/sdk` (already bundled), Node `child_process`, Vitest. Spawns the external `claude` CLI (v2.1.160).

**Reference spec:** `docs/superpowers/specs/2026-06-02-ask-claude-feature-design.md`
**Live target:** `/Volumes/ExtData/Applications/Ableton Live 12 Beta.app`
**Always prefix shell with:** `export PATH="/Users/thomasgallaway/.asdf/shims:$PATH"`

---

## Verified facts from spikes (do not re-litigate)

- The host spawns `claude` by ABSOLUTE path with `{ env: process.env }` and drives the MCP loop (returned live `get_song_overview` data, `is_error:false`). A stripped env → "Not logged in", so we MUST pass the host env through.
- Safe permissions: `--allowedTools "mcp__ableton__*"` + default mode, NO `bypassPermissions`.
- `--output-format json` returns an object with `result`, `is_error`, `num_turns`, `total_cost_usd`, `permission_denials`.
- `claude` is at `/Users/thomasgallaway/.local/bin/claude` (symlink); resolve dynamically.
- `ui.showModalDialog(url, w, h): Promise<string>` accepts `data:`/`file:`/`https:`/`http://localhost`; the page returns a value by posting `{ method: "close_and_send", params: [resultString] }` to `window.webkit.messageHandlers.live.postMessage` (macOS) or `window.chrome.webview.postMessage` (Windows). **(Text-return is the one thing the live gate confirms.)**
- `ui.registerContextMenuAction(scope, title, commandId): Promise<() => Promise<void>>` and `commands.registerCommand(commandId, async (arg) => …)`; for scope `"ClipSlot"` the command arg is the triggered slot's `Handle`. Resolve via `context.getObjectFromHandle(handle, ableton.ClipSlot)`.

---

## File Structure (all under `ableton-mcp/`)

| File | Responsibility |
|---|---|
| `src/core/agentConfig.ts` | resolve claude binary path; default model; allowed-tools; max-turns |
| `src/agent/prompt.ts` | `composePrompt(selection, instruction)` → string |
| `src/agent/mcpConfigFile.ts` | write temp `--mcp-config` JSON (0600); cleanup |
| `src/agent/resultParser.ts` | `parseClaudeResult(stdout)` → structured result |
| `src/agent/spawnClaude.ts` | `runClaude(opts)` — spawn wrapper (host glue, live-verified) |
| `src/selection/types.ts` | `SelectionContext` |
| `src/selection/capture.ts` | `captureClipSlot(slot)` → `SelectionContext` |
| `src/selection/modalHtml.ts` | `buildInstructionModalHtml()`, `toDataUrl(html)` |
| `src/selection/askClaude.ts` | register "Ask Claude…" + command handler (host glue, live-verified) |
| `src/extension.ts` | wire `registerAskClaude(...)` after server starts (modify) |
| `test/*` | unit tests for the pure helpers |

---

## Task 1: Agent config (claude path + defaults)

**Files:** Create `ableton-mcp/src/core/agentConfig.ts`, `ableton-mcp/test/agentConfig.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/agentConfig.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/agentConfig.test.ts`
Expected: FAIL — cannot find module `../src/core/agentConfig.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/agentConfig.ts
export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const ALLOWED_TOOLS = "mcp__ableton__*";
export const MAX_TURNS = 12;

export interface ResolveClaudeOptions {
  env: NodeJS.ProcessEnv;
  home: string;
  exists: (path: string) => boolean;
}

/** Find the claude CLI: explicit override → ~/.local/bin/claude → bare "claude" (PATH). */
export function resolveClaudePath(opts: ResolveClaudeOptions): string {
  const configured = opts.env.ABLETON_MCP_CLAUDE_PATH;
  if (configured && opts.exists(configured)) return configured;
  const local = `${opts.home}/.local/bin/claude`;
  if (opts.exists(local)) return local;
  return "claude";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/agentConfig.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/core/agentConfig.ts ableton-mcp/test/agentConfig.test.ts
git commit -m "feat: agent config (claude path resolution + defaults)"
```

---

## Task 2: Selection types + clip-slot capture

**Files:** Create `ableton-mcp/src/selection/types.ts`, `ableton-mcp/src/selection/capture.ts`, `ableton-mcp/test/capture.test.ts`

- [ ] **Step 1: Create the types**

```ts
// src/selection/types.ts
export interface SelectionContext {
  kind: "clipSlot";
  hasClip: boolean;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// test/capture.test.ts
import { describe, it, expect } from "vitest";
import { captureClipSlot } from "../src/selection/capture.js";

describe("captureClipSlot", () => {
  it("reports hasClip=false for an empty slot", () => {
    expect(captureClipSlot({ clip: null })).toEqual({ kind: "clipSlot", hasClip: false });
  });
  it("reports hasClip=true for an occupied slot", () => {
    expect(captureClipSlot({ clip: { name: "Loop" } })).toEqual({ kind: "clipSlot", hasClip: true });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/capture.test.ts`
Expected: FAIL — cannot find module `../src/selection/capture.js`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/selection/capture.ts
import type { SelectionContext } from "./types.js";

/** Minimal structural view of a ClipSlot — just enough for AC-M0. */
export interface ClipSlotLike {
  readonly clip: unknown | null;
}

/** Snapshot a resolved clip slot into a plain SelectionContext. */
export function captureClipSlot(slot: ClipSlotLike): SelectionContext {
  return { kind: "clipSlot", hasClip: slot.clip != null };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/capture.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/selection/types.ts ableton-mcp/src/selection/capture.ts ableton-mcp/test/capture.test.ts
git commit -m "feat: selection context + clip-slot capture"
```

---

## Task 3: Prompt composition

**Files:** Create `ableton-mcp/src/agent/prompt.ts`, `ableton-mcp/test/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/prompt.test.ts
import { describe, it, expect } from "vitest";
import { composePrompt } from "../src/agent/prompt.js";

describe("composePrompt", () => {
  it("embeds the instruction and selection, and points at the ableton tools", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: false }, "make a 4-bar bassline");
    expect(p).toContain("make a 4-bar bassline");
    expect(p).toContain("clip slot");
    expect(p).toContain("hasClip=false");
    expect(p.toLowerCase()).toContain("ableton");
  });
  it("does not let an empty instruction produce an empty prompt", () => {
    const p = composePrompt({ kind: "clipSlot", hasClip: true }, "");
    expect(p.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/prompt.test.ts`
Expected: FAIL — cannot find module `../src/agent/prompt.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/agent/prompt.ts
import type { SelectionContext } from "../selection/types.js";

/** Build the headless-claude prompt from the captured selection + the producer's instruction. */
export function composePrompt(selection: SelectionContext, instruction: string): string {
  const trimmed = instruction.trim();
  return [
    "You are assisting a music producer inside Ableton Live.",
    "You have Ableton tools available via MCP (e.g. get_song_overview); use them as needed.",
    `The producer selected a Session clip slot (hasClip=${selection.hasClip}).`,
    `Their instruction: "${trimmed}".`,
    "Act on the selected slot using the tools. Then reply with a one-sentence summary of what you did.",
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/agent/prompt.ts ableton-mcp/test/prompt.test.ts
git commit -m "feat: prompt composition from selection + instruction"
```

---

## Task 4: Temp MCP-config writer

**Files:** Create `ableton-mcp/src/agent/mcpConfigFile.ts`, `ableton-mcp/test/mcpConfigFile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/mcpConfigFile.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { writeMcpConfig } from "../src/agent/mcpConfigFile.js";

describe("writeMcpConfig", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ablcfg-"));
  });

  it("writes a 0600 JSON config pointing at the local MCP server with the bearer token", () => {
    const file = writeMcpConfig({ dir, host: "127.0.0.1", port: 9787, token: "t0ken", path: "/mcp" });
    const mode = fs.statSync(file).mode & 0o777;
    expect(mode).toBe(0o600);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(parsed.mcpServers.ableton.type).toBe("http");
    expect(parsed.mcpServers.ableton.url).toBe("http://127.0.0.1:9787/mcp");
    expect(parsed.mcpServers.ableton.headers.Authorization).toBe("Bearer t0ken");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/mcpConfigFile.test.ts`
Expected: FAIL — cannot find module `../src/agent/mcpConfigFile.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/agent/mcpConfigFile.ts
import * as fs from "node:fs";
import * as path from "node:path";

export interface McpConfigOptions {
  dir: string;
  host: string;
  port: number;
  token: string;
  path: string; // MCP endpoint path, e.g. "/mcp"
}

/** Write a temp `--mcp-config` JSON (0600) describing our localhost MCP server. Returns its path. */
export function writeMcpConfig(opts: McpConfigOptions): string {
  const config = {
    mcpServers: {
      ableton: {
        type: "http",
        url: `http://${opts.host}:${opts.port}${opts.path}`,
        headers: { Authorization: `Bearer ${opts.token}` },
      },
    },
  };
  const file = path.join(opts.dir, "ableton-mcp-claude-config.json");
  fs.writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
  return file;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/mcpConfigFile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/agent/mcpConfigFile.ts ableton-mcp/test/mcpConfigFile.test.ts
git commit -m "feat: temp MCP-config writer for spawned claude"
```

---

## Task 5: Result parser

**Files:** Create `ableton-mcp/src/agent/resultParser.ts`, `ableton-mcp/test/resultParser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/resultParser.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/resultParser.test.ts`
Expected: FAIL — cannot find module `../src/agent/resultParser.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/agent/resultParser.ts
export interface ClaudeResult {
  isError: boolean;
  resultText: string;
  costUsd: number | null;
  numTurns: number | null;
}

/** Parse `claude --output-format json` stdout into a structured result. Never throws. */
export function parseClaudeResult(stdout: string): ClaudeResult {
  try {
    const obj = JSON.parse(stdout) as Record<string, unknown>;
    const isError = obj.is_error === true;
    const resultText = typeof obj.result === "string" ? obj.result : JSON.stringify(obj.result ?? "");
    const costUsd = typeof obj.total_cost_usd === "number" ? obj.total_cost_usd : null;
    const numTurns = typeof obj.num_turns === "number" ? obj.num_turns : null;
    return { isError, resultText, costUsd, numTurns };
  } catch {
    return { isError: true, resultText: `Unparseable claude output: ${stdout.slice(0, 500)}`, costUsd: null, numTurns: null };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/resultParser.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/agent/resultParser.ts ableton-mcp/test/resultParser.test.ts
git commit -m "feat: claude result parser"
```

---

## Task 6: Modal HTML + data URL

**Files:** Create `ableton-mcp/src/selection/modalHtml.ts`, `ableton-mcp/test/modalHtml.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/modalHtml.test.ts
import { describe, it, expect } from "vitest";
import { buildInstructionModalHtml, toDataUrl, CANCEL_SENTINEL } from "../src/selection/modalHtml.js";

describe("buildInstructionModalHtml", () => {
  const html = buildInstructionModalHtml();
  it("has a textarea and Send/Cancel controls", () => {
    expect(html).toContain("<textarea");
    expect(html.toLowerCase()).toContain("send");
    expect(html.toLowerCase()).toContain("cancel");
  });
  it("posts results via the host message handlers using close_and_send", () => {
    expect(html).toContain("close_and_send");
    expect(html).toContain("webkit.messageHandlers.live");
    expect(html).toContain("chrome.webview"); // Windows fallback
  });
  it("uses the cancel sentinel for the Cancel control", () => {
    expect(html).toContain(CANCEL_SENTINEL);
  });
});

describe("toDataUrl", () => {
  it("produces a base64 data: URL", () => {
    const url = toDataUrl("<h1>x</h1>");
    expect(url.startsWith("data:text/html;base64,")).toBe(true);
    expect(Buffer.from(url.split(",")[1], "base64").toString("utf8")).toBe("<h1>x</h1>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/modalHtml.test.ts`
Expected: FAIL — cannot find module `../src/selection/modalHtml.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/selection/modalHtml.ts
export const CANCEL_SENTINEL = "__ABLETON_MCP_CANCEL__";

/** Self-contained HTML form: textarea + Send/Cancel. Posts the typed text (or the cancel
 *  sentinel) back to the host via close_and_send. No remote resources. */
export function buildInstructionModalHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:14px -apple-system,system-ui,sans-serif;margin:0;padding:16px;background:#1e1e1e;color:#eee}
    textarea{width:100%;height:120px;box-sizing:border-box;background:#2a2a2a;color:#eee;border:1px solid #444;border-radius:6px;padding:8px;font:14px inherit;resize:vertical}
    .row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
    button{font:14px inherit;padding:8px 16px;border-radius:6px;border:0;cursor:pointer}
    .send{background:#3b82f6;color:#fff}.cancel{background:#3a3a3a;color:#ddd}
    h3{margin:0 0 8px}</style></head><body>
    <h3>Ask Claude</h3>
    <textarea id="t" placeholder="e.g. make a 4-bar minor-key bassline" autofocus></textarea>
    <div class="row">
      <button class="cancel" onclick="post('${CANCEL_SENTINEL}')">Cancel</button>
      <button class="send" onclick="post(document.getElementById('t').value)">Send</button>
    </div>
    <script>
      function post(v){
        var msg={method:"close_and_send",params:[v]};
        if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.live){
          window.webkit.messageHandlers.live.postMessage(msg);
        } else if(window.chrome&&window.chrome.webview){
          window.chrome.webview.postMessage(msg);
        }
      }
      document.getElementById('t').addEventListener('keydown',function(e){
        if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){post(document.getElementById('t').value);}
      });
    </script></body></html>`;
}

/** Wrap HTML as a base64 data: URL for ui.showModalDialog. */
export function toDataUrl(html: string): string {
  return `data:text/html;base64,${Buffer.from(html, "utf8").toString("base64")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/modalHtml.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/selection/modalHtml.ts ableton-mcp/test/modalHtml.test.ts
git commit -m "feat: instruction modal HTML + data URL"
```

---

## Task 7: Claude spawn wrapper (host glue — unit-test the arg builder)

The spawn itself is verified live; its **argument builder** is pure and unit-tested.

**Files:** Create `ableton-mcp/src/agent/spawnClaude.ts`, `ableton-mcp/test/spawnClaude.test.ts`

- [ ] **Step 1: Write the failing test (arg builder only)**

```ts
// test/spawnClaude.test.ts
import { describe, it, expect } from "vitest";
import { buildClaudeArgs } from "../src/agent/spawnClaude.js";

describe("buildClaudeArgs", () => {
  it("assembles headless flags with config, allowlist, model, max-turns and json output", () => {
    const args = buildClaudeArgs({
      prompt: "do the thing",
      configPath: "/tmp/c.json",
      model: "claude-sonnet-4-6",
      allowedTools: "mcp__ableton__*",
      maxTurns: 12,
    });
    expect(args).toEqual([
      "-p", "do the thing",
      "--mcp-config", "/tmp/c.json",
      "--strict-mcp-config",
      "--allowedTools", "mcp__ableton__*",
      "--model", "claude-sonnet-4-6",
      "--max-turns", "12",
      "--output-format", "json",
    ]);
  });
  it("never includes a bypass-permissions flag", () => {
    const args = buildClaudeArgs({ prompt: "x", configPath: "/c", model: "m", allowedTools: "a", maxTurns: 1 });
    expect(args.join(" ")).not.toContain("bypassPermissions");
    expect(args.join(" ")).not.toContain("--dangerously");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/spawnClaude.test.ts`
Expected: FAIL — cannot find module `../src/agent/spawnClaude.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/agent/spawnClaude.ts
import { spawn } from "node:child_process";
import { parseClaudeResult, type ClaudeResult } from "./resultParser.js";

export interface ClaudeArgsOptions {
  prompt: string;
  configPath: string;
  model: string;
  allowedTools: string;
  maxTurns: number;
}

/** Build the headless claude argv. Pure + unit-tested. Never adds a bypass flag. */
export function buildClaudeArgs(opts: ClaudeArgsOptions): string[] {
  return [
    "-p", opts.prompt,
    "--mcp-config", opts.configPath,
    "--strict-mcp-config",
    "--allowedTools", opts.allowedTools,
    "--model", opts.model,
    "--max-turns", String(opts.maxTurns),
    "--output-format", "json",
  ];
}

export interface RunClaudeOptions extends ClaudeArgsOptions {
  claudePath: string;
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
}

/** Spawn claude headless and resolve a parsed result. Verified at the live gate. */
export function runClaude(opts: RunClaudeOptions): Promise<ClaudeResult> {
  return new Promise((resolve) => {
    const child = spawn(opts.claudePath, buildClaudeArgs(opts), {
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
      signal: opts.signal,
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) => {
      resolve({ isError: true, resultText: `spawn failed: ${e.message}`, costUsd: null, numTurns: null });
    });
    child.on("close", () => {
      resolve(out.trim().length > 0 ? parseClaudeResult(out) : { isError: true, resultText: err.trim() || "no output", costUsd: null, numTurns: null });
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run test/spawnClaude.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/agent/spawnClaude.ts ableton-mcp/test/spawnClaude.test.ts
git commit -m "feat: claude spawn wrapper + arg builder"
```

---

## Task 8: Wire "Ask Claude" into the extension (host glue)

This is the integration layer — no unit test (it touches the SDK UI/commands and spawns claude). It MUST be fully guarded so nothing can crash the host.

**Files:** Create `ableton-mcp/src/selection/askClaude.ts`; Modify `ableton-mcp/src/extension.ts`

- [ ] **Step 1: Create the registration + handler**

```ts
// src/selection/askClaude.ts
import * as os from "node:os";
import * as fs from "node:fs";
import * as ableton from "@ableton-extensions/sdk";
import { log } from "../core/logger.js";
import { HOST, PORT, MCP_PATH } from "../core/config.js";
import { DEFAULT_MODEL, ALLOWED_TOOLS, MAX_TURNS, resolveClaudePath } from "../core/agentConfig.js";
import { captureClipSlot, type ClipSlotLike } from "./capture.js";
import { buildInstructionModalHtml, toDataUrl, CANCEL_SENTINEL } from "./modalHtml.js";
import { composePrompt } from "../agent/prompt.js";
import { writeMcpConfig } from "../agent/mcpConfigFile.js";
import { runClaude } from "../agent/spawnClaude.js";

export interface AskClaudeDeps {
  context: ableton.ExtensionContext<"1.0.0">;
  token: string;
}

/** Register the "Ask Claude…" Session-cell action and its command handler. */
export async function registerAskClaude(deps: AskClaudeDeps): Promise<void> {
  const { context, token } = deps;
  const commandId = "ableton-mcp.askClaude.clipSlot";

  context.commands.registerCommand(commandId, async (arg: unknown) => {
    try {
      const slot = context.getObjectFromHandle(arg as ableton.Handle, ableton.ClipSlot);
      const selection = captureClipSlot(slot as unknown as ClipSlotLike);

      const instruction = await context.ui.showModalDialog(toDataUrl(buildInstructionModalHtml()), 460, 280);
      if (!instruction || instruction === CANCEL_SENTINEL || instruction.trim() === "") {
        return;
      }

      const tmpDir = context.environment.tempDirectory ?? os.tmpdir();
      const configPath = writeMcpConfig({ dir: tmpDir, host: HOST, port: PORT, token, path: MCP_PATH });
      const claudePath = resolveClaudePath({ env: process.env, home: os.homedir(), exists: fs.existsSync });
      const prompt = composePrompt(selection, instruction);

      const result = await context.ui.withinProgressDialog(
        "Asking Claude…",
        { progress: 0 },
        async (update, signal) => {
          await update("Claude is working…", 50);
          const r = await runClaude({
            claudePath, prompt, configPath, model: DEFAULT_MODEL,
            allowedTools: ALLOWED_TOOLS, maxTurns: MAX_TURNS, env: process.env, signal,
          });
          await update("Done", 100);
          return r;
        },
      );

      try { fs.unlinkSync(configPath); } catch { /* best effort */ }

      const r = result as { isError: boolean; resultText: string; costUsd: number | null; numTurns: number | null };
      const cost = r.costUsd != null ? ` ($${r.costUsd.toFixed(2)}, ${r.numTurns ?? "?"} turns)` : "";
      const body = `<!doctype html><meta charset="utf-8"><body style="font:14px -apple-system,sans-serif;background:#1e1e1e;color:#eee;padding:16px">
        <h3 style="margin:0 0 8px">${r.isError ? "Claude error" : "Claude"}${cost}</h3>
        <pre style="white-space:pre-wrap;word-break:break-word">${r.resultText.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string))}</pre>
        <div style="display:flex;justify-content:flex-end"><button style="padding:8px 16px;border:0;border-radius:6px;background:#3b82f6;color:#fff" onclick="(window.webkit&&window.webkit.messageHandlers.live?window.webkit.messageHandlers.live:window.chrome.webview).postMessage({method:'close_and_send',params:['ok']})">Close</button></div>
        </body>`;
      await context.ui.showModalDialog(toDataUrl(body), 460, 320);
    } catch (e) {
      log.error(`askClaude failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  await context.ui.registerContextMenuAction("ClipSlot", "Ask Claude…", commandId);
  log.info('registered "Ask Claude…" on ClipSlot');
}
```

- [ ] **Step 2: Wire it into `activate()`** — modify `src/extension.ts`. Inside the `startHttpServer(...).then(({ port }) => { ... })` callback, after the existing two `log.info(...)` lines, add the registration (using the same `context` and `token` already in scope):

```ts
      // Register the selection-driven "Ask Claude…" action now that the server (and token) are live.
      void registerAskClaude({ context, token }).catch((e) =>
        log.error(`failed to register Ask Claude: ${String(e)}`),
      );
```

And add the import near the other imports at the top of `src/extension.ts`:

```ts
import { registerAskClaude } from "./selection/askClaude.js";
```

- [ ] **Step 3: Typecheck + full build**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npm run build`
Expected: `tsc --noEmit` clean; esbuild writes `dist/extension.js`. If tsc complains that `ableton.ClipSlot`'s `.clip` isn't assignable to `ClipSlotLike`, the `as unknown as ClipSlotLike` cast in askClaude.ts handles it — do NOT use `any`. If `withinProgressDialog`'s return type is `unknown`, the `as { … }` cast in Step 1 handles it.

- [ ] **Step 4: Run the full unit suite (no regressions)**

Run: `cd ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH" && npx vitest run`
Expected: all tests pass (M0 + AC-M0 helpers).

- [ ] **Step 5: Commit**

```bash
cd /Volumes/ExtData2/coding/thefck
git add ableton-mcp/src/selection/askClaude.ts ableton-mcp/src/extension.ts
git commit -m "feat: wire Ask Claude context-menu action into the extension"
```

---

## Task 9: Live gate — prove it in Ableton

Verification task (no new code). Confirms the two unknowns: `showModalDialog` text return + in-host spawn.

- [ ] **Step 1: Ensure Live is running and no stale hosts**

Run:
```bash
export PATH="/Users/thomasgallaway/.asdf/shims:$PATH"
pkill -9 -f "ExtensionHostNodeModule|extensions-cli" 2>/dev/null; sleep 1
open "/Volumes/ExtData/Applications/Ableton Live 12 Beta.app"
```
Wait for Live to finish loading (dismiss any dialog).

- [ ] **Step 2: Build and launch the host**

Run:
```bash
cd /Volumes/ExtData2/coding/thefck/ableton-mcp && export PATH="/Users/thomasgallaway/.asdf/shims:$PATH"
npm run build
npx extensions-cli run --live "/Volumes/ExtData/Applications/Ableton Live 12 Beta.app" > /tmp/ableton-mcp-run.log 2>&1 &
```
Wait until `/tmp/ableton-mcp-run.log` shows both `MCP server listening on http://127.0.0.1:9787/mcp` and `registered "Ask Claude…" on ClipSlot`.

- [ ] **Step 3: Trigger the action in Live**

In Live's Session view: right-click an **empty** clip slot → confirm **"Ask Claude…"** appears in the context menu → click it → confirm a **text box modal opens**. Type: `Tell me the current tempo and how many tracks there are.` → click **Send**.

Expected: a progress dialog ("Asking Claude…") appears, then a result modal shows Claude's answer (which should reflect the real tempo/track count from `get_song_overview`) plus a cost/turns line.

- [ ] **Step 4: Confirm via the host log**

Run: `grep -iE "askClaude|registered|error" /tmp/ableton-mcp-run.log | tail -20`
Expected: registration logged; no `askClaude failed` error. (Claude's own tool calls also hit the MCP server.)

- [ ] **Step 5: Confirm Cancel path**

Right-click another slot → "Ask Claude…" → click **Cancel** in the modal.
Expected: dialog closes, nothing spawns, no error in the log, host still listening (`lsof -nP -iTCP:9787 | grep LISTEN`).

- [ ] **Step 6: Record the result in the spec**

Append an "AC-M0 verified (date)" note to `docs/superpowers/specs/2026-06-02-ask-claude-feature-design.md` summarizing what passed (modal text return ✓, in-host spawn ✓, cost shown ✓), then commit:

```bash
cd /Volumes/ExtData2/coding/thefck
git add docs/superpowers/specs/2026-06-02-ask-claude-feature-design.md
git commit -m "docs: record AC-M0 live verification"
```

---

## Self-Review

**Spec coverage (AC-M0 scope):**
- Context-menu "Ask Claude…" on ClipSlot → Task 8, 9 ✅
- Modal text input (`showModalDialog`) → Tasks 6, 8, 9 ✅
- Selection capture → Task 2 ✅
- Spawn claude headless w/ host env, allowlist, no bypass → Tasks 7, 8 (+ verified Task 9) ✅
- `--mcp-config` to our own server w/ token → Task 4, 8 ✅
- Sonnet default, max-turns cap → Task 1, 7 ✅
- Cost shown after run → Task 8 (result modal), 9 ✅
- Prompt from selection + instruction → Task 3 ✅
- Host-crash safety (guarded handler) → Task 8 (try/catch in command) ✅
- (AC-M1..M4 — get_selection tool, real edit tools, model selector, broader scopes — intentionally out of AC-M0 scope.)

**Placeholder scan:** No TBD/TODO; every code step has complete code; every run step has exact command + expected output. tsc-friction notes in Task 8 are tied to concrete casts already present in the code, not deferred work.

**Type consistency:** `SelectionContext` (Task 2) consumed identically in `composePrompt` (Task 3) and `askClaude` (Task 8). `ClipSlotLike` (Task 2) used in Task 8's cast. `writeMcpConfig` options (Task 4) match the call in Task 8. `ClaudeResult` (Task 5) returned by `runClaude` (Task 7) and consumed in Task 8. `buildClaudeArgs`/`runClaude` options (Task 7) match Task 8's call. `DEFAULT_MODEL`/`ALLOWED_TOOLS`/`MAX_TURNS`/`resolveClaudePath` (Task 1) used in Task 8. `buildInstructionModalHtml`/`toDataUrl`/`CANCEL_SENTINEL` (Task 6) used in Task 8. `HOST`/`PORT`/`MCP_PATH` come from M0's `core/config.ts`.
