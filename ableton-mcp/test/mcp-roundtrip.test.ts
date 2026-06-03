import { describe, it, expect } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import * as ableton from "@ableton-extensions/sdk";
import { buildMcpServer } from "../src/mcp/server.js";

function fakeContext(): ableton.ExtensionContext<"1.0.0"> {
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
  } as unknown as ableton.ExtensionContext<"1.0.0">;
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
