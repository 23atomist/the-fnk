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

  it("returns 404 for a non-/mcp path", async () => {
    const started = await startHttpServer({ context: fakeContext(), token: TOKEN, host: "127.0.0.1", port: 0 });
    server = started.server;
    const res = await fetch(`http://127.0.0.1:${started.port}/healthz`, {
      method: "GET",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(404);
  });
});
