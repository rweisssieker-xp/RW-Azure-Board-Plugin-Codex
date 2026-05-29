import { createServer } from "node:http";
import { handle } from "./server.js";
const port = Number(process.env.PORT || process.env.AZURE_BOARDS_MCP_PORT || 3000);
const host = process.env.HOST || process.env.AZURE_BOARDS_MCP_HOST || "127.0.0.1";
const maxBodyBytes = Number(process.env.AZURE_BOARDS_MCP_MAX_BODY_BYTES || 1_000_000);
const server = createServer((request, response) => {
    const method = request.method || "GET";
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (method === "GET" && url.pathname === "/healthz") {
        writeJson(response, 200, {
            status: "ok",
            service: "azure-boards-mcp",
            authConfigured: Boolean(process.env.AZURE_BOARDS_CLIENT_ID || process.env.AZURE_BOARDS_PAT || process.env.AZURE_DEVOPS_PAT || process.env.AZURE_BOARDS_BEARER_TOKEN),
            hostedMcpUrlConfigured: Boolean(process.env.AZURE_BOARDS_HOSTED_MCP_URL)
        });
        return;
    }
    if (method !== "POST" || url.pathname !== "/mcp") {
        writeJson(response, 404, { error: "Not found. Use POST /mcp for JSON-RPC or GET /healthz." });
        return;
    }
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
        body += chunk;
        if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
            request.destroy(new Error("Request body too large."));
        }
    });
    request.on("error", (error) => {
        writeJson(response, 413, { error: error.message });
    });
    request.on("end", () => {
        void handleHttpBody(body, response);
    });
});
server.listen(port, host, () => {
    process.stderr.write(`Azure Boards hosted MCP listening on http://${host}:${port}/mcp\n`);
});
async function handleHttpBody(body, response) {
    try {
        const parsed = JSON.parse(body);
        if (Array.isArray(parsed)) {
            const results = await Promise.all(parsed.map((request) => handle(request)));
            writeJson(response, 200, results.filter((entry) => entry !== null));
            return;
        }
        const result = await handle(parsed);
        if (result === null) {
            response.writeHead(202).end();
            return;
        }
        writeJson(response, 200, result);
    }
    catch (error) {
        writeJson(response, 400, {
            jsonrpc: "2.0",
            id: null,
            error: {
                code: -32700,
                message: error instanceof Error ? error.message : String(error)
            }
        });
    }
}
function writeJson(response, status, value) {
    response.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
    });
    response.end(`${JSON.stringify(value)}\n`);
}
