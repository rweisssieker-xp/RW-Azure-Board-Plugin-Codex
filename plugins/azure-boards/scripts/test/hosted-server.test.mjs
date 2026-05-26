import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";

test("hosted MCP server exposes health and JSON-RPC tools/list over HTTP", async () => {
  const port = 43177;
  const child = spawn(process.execPath, ["dist/hostedServer.js"], {
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, AZURE_BOARDS_MCP_PORT: String(port), AZURE_BOARDS_MCP_HOST: "127.0.0.1" }
  });
  try {
    await waitForHealth(port);

    const health = await fetchJson(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, "ok");
    assert.equal(health.service, "azure-boards-mcp");

    const listed = await fetchJson(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    });
    assert.equal(listed.id, 1);
    assert.ok(listed.result.tools.some((tool) => tool.name === "azure_boards_product_approval_queue"));

    const smoke = spawnSync(process.execPath, ["hosted-mcp-smoke.mjs", `http://127.0.0.1:${port}/mcp`], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    assert.equal(smoke.status, 0, smoke.stderr);
    assert.match(smoke.stdout, /Hosted MCP smoke test passed/);
  } finally {
    child.kill();
    await once(child, "exit");
  }
});

async function waitForHealth(port) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("hosted MCP server did not become healthy");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  assert.equal(response.ok, true, `${url} should return success`);
  return response.json();
}
