import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("MCP server lists Azure Boards tools", async () => {
  const child = spawn(process.execPath, ["dist/server.js"], { stdio: ["pipe", "pipe", "pipe"] });
  try {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
    const init = JSON.parse((await readLine(child.stdout)).trim());
    assert.equal(init.result.serverInfo.name, "azure-boards");

    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
    const listed = JSON.parse((await readLine(child.stdout)).trim());
    const names = listed.result.tools.map((tool) => tool.name);
    const expectedTools = [
      "azure_boards_query_work_items",
      "azure_boards_ai_delivery_risk_radar",
      "azure_boards_ai_governance_score",
      "azure_boards_login",
      "azure_boards_auth_status",
      "azure_boards_whoami",
      "azure_boards_ai_project_cockpit",
      "azure_boards_ai_comment_intelligence",
      "azure_boards_ai_role_based_report",
      "azure_boards_ai_flow_mining_from_updates",
      "azure_boards_ai_policy_pack_summary",
      "azure_boards_ai_watchlist_report",
      "azure_boards_ai_action_plan",
      "azure_boards_ai_create_process_baseline",
      "azure_boards_ai_process_drift_detection",
      "azure_boards_ai_cost_of_delay_radar",
      "azure_boards_ai_process_simulator",
      "azure_boards_ai_capacity_forecast",
      "azure_boards_ai_brief_export"
    ];
    const missing = expectedTools.filter((name) => !names.includes(name));
    assert.deepEqual(missing, [], `Expected MCP tools to be listed: ${expectedTools.join(", ")}`);
  } finally {
    child.kill();
    await once(child, "exit");
  }
});

function readLine(stream) {
  return new Promise((resolve) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const index = buffer.indexOf("\n");
      if (index >= 0) {
        stream.off("data", onData);
        resolve(buffer.slice(0, index + 1));
      }
    };
    stream.on("data", onData);
  });
}
