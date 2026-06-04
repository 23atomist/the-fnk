import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import * as ableton from "@ableton-extensions/sdk";
import { buildMcpServer } from "../mcp/server.js";
import { verifyAuthHeader } from "./auth.js";
import { MCP_PATH } from "../core/config.js";
import { log } from "../core/logger.js";

export interface StartHttpOptions {
  context: ableton.ExtensionContext<"1.0.0">;
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

/**
 * Start the MCP HTTP server. Resolves once listening; `port` is the actual bound port.
 *
 * Stateful Streamable HTTP: a transport (and its McpServer) is created on the client's
 * `initialize` request, keyed by the generated `Mcp-Session-Id`, and reused for every
 * subsequent POST/GET/DELETE on that session. The Claude Code MCP client requires this —
 * a stateless (session-less) server leaves tool calls unresolved (error_max_turns).
 */
export function startHttpServer(opts: StartHttpOptions): Promise<StartedHttp> {
  const transports = new Map<string, StreamableHTTPServerTransport>();

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
        const sessionId = req.headers["mcp-session-id"];
        const sid = typeof sessionId === "string" ? sessionId : undefined;

        let transport = sid ? transports.get(sid) : undefined;

        if (!transport) {
          if (req.method === "POST" && isInitializeRequest(body)) {
            // New session: create a stateful transport + a fresh McpServer bound to it.
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (newId) => {
                transports.set(newId, transport as StreamableHTTPServerTransport);
              },
            });
            transport.onclose = () => {
              if (transport?.sessionId) transports.delete(transport.sessionId);
            };
            const mcp = buildMcpServer(opts.context);
            await mcp.connect(transport);
          } else {
            // Non-initialize request with no (valid) session — nothing to handle.
            sendJson(res, 400, { error: "missing or invalid mcp-session-id" });
            return;
          }
        }

        await transport.handleRequest(req, res, body);
      } catch (err) {
        log.error(`http handler error: ${err instanceof Error ? err.message : String(err)}`);
        if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
      }
    })();
  });

  return new Promise<StartedHttp>((resolve, reject) => {
    // Before listening, a listen error (e.g. EADDRINUSE) must reject so callers learn of it.
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        log.error(`port ${opts.port} already in use — is another Live/extension instance running?`);
      } else {
        log.error(`server error before listen: ${err.message}`);
      }
      reject(err);
    });
    server.listen(opts.port, opts.host, () => {
      // Now listening: swap to a non-rejecting handler for post-listen runtime errors.
      server.removeAllListeners("error");
      server.on("error", (err: NodeJS.ErrnoException) => {
        log.error(`server runtime error: ${err.message}`);
      });
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : opts.port;
      resolve({ server, port });
    });
  });
}
