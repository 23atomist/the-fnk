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
