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
      "azure_boards_ai_brief_export",
      "azure_boards_ai_requirement_decision_cockpit",
      "azure_boards_ai_evidence_first_requirement_review",
      "azure_boards_ai_cio_requirement_risk_view",
      "azure_boards_ai_portfolio_rationalization",
      "azure_boards_ai_benefit_realization_tracking",
      "azure_boards_ai_cost_avoidance_by_closure",
      "azure_boards_ai_erp_domain_impact_scoring",
      "azure_boards_ai_closure_governance_ledger",
      "azure_boards_ai_audit_decision_log",
      "azure_boards_ai_board_hygiene_automation_preview",
      "azure_boards_ai_evidence_pack_completeness",
      "azure_boards_ai_outcome_realization_cockpit",
      "azure_boards_ai_business_case_generator",
      "azure_boards_ai_value_leakage_detector",
      "azure_boards_ai_decision_traceability_graph",
      "azure_boards_ai_erp_process_criticality_model",
      "azure_boards_ai_board_due_diligence_report",
      "azure_boards_ai_requirement_invest_divest_matrix",
      "azure_boards_ai_change_portfolio_simulator",
      "azure_boards_ai_steering_committee_pack",
      "azure_boards_ai_policy_as_code_evaluation",
      "azure_boards_ai_autonomous_board_auditor",
      "azure_boards_ai_requirement_rewrite_studio",
      "azure_boards_ai_decision_meeting_copilot",
      "azure_boards_ai_cleanup_campaign_manager",
      "azure_boards_ai_financial_backlog_ledger",
      "azure_boards_ai_requirement_confidence_score",
      "azure_boards_ai_dependency_blocker_graph",
      "azure_boards_ai_process_owner_control_tower",
      "azure_boards_ai_migration_cutover_readiness",
      "azure_boards_ai_exception_register",
      "azure_boards_ai_benefit_realization_followup"
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
