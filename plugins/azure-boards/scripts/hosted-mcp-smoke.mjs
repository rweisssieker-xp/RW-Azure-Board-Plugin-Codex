const endpoints = resolveEndpoints(process.argv[2] ?? process.env.AZURE_BOARDS_HOSTED_MCP_URL);

if (!endpoints) {
  console.error("Usage: node hosted-mcp-smoke.mjs https://your-owned-domain.example/mcp");
  console.error("Or set AZURE_BOARDS_HOSTED_MCP_URL.");
  process.exit(1);
}

const failures = [];

try {
  const health = await fetchJson(endpoints.healthUrl, { method: "GET" });
  if (health.status !== "ok") {
    failures.push(`healthz status should be ok, got ${JSON.stringify(health.status)}`);
  }
  if (health.service !== "azure-boards-mcp") {
    failures.push(`healthz service should be azure-boards-mcp, got ${JSON.stringify(health.service)}`);
  }
} catch (error) {
  failures.push(`healthz request failed: ${error.message}`);
}

try {
  const listed = await fetchJson(endpoints.mcpUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
  });
  const tools = listed?.result?.tools;
  if (!Array.isArray(tools)) {
    failures.push("tools/list response should include result.tools array");
  } else {
    for (const requiredTool of [
      "azure_boards_product_snapshot_save",
      "azure_boards_product_approval_queue",
      "azure_boards_product_decision_pack_export"
    ]) {
      if (!tools.some((tool) => tool.name === requiredTool)) {
        failures.push(`tools/list should include ${requiredTool}`);
      }
    }
  }
} catch (error) {
  failures.push(`mcp tools/list request failed: ${error.message}`);
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  process.exit(1);
}

console.log(`Hosted MCP smoke test passed for ${endpoints.mcpUrl.href}`);

function resolveEndpoints(value) {
  if (!value) return null;
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Hosted MCP URL must use http or https.");
  }
  const origin = `${parsed.protocol}//${parsed.host}`;
  const segments = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const prefix = segments.at(-1) === "mcp" ? segments.slice(0, -1) : segments;
  const basePath = prefix.length ? `/${prefix.join("/")}` : "";
  return {
    healthUrl: new URL(`${basePath}/healthz`, origin),
    mcpUrl: new URL(`${basePath}/mcp`, origin)
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${url.href} returned HTTP ${response.status}`);
  }
  return response.json();
}
