import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";

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
      "azure_boards_ai_benefit_realization_followup",
      "azure_boards_ai_operating_rhythm_planner",
      "azure_boards_ai_okr_alignment_scorer",
      "azure_boards_ai_compliance_readiness_review",
      "azure_boards_ai_handover_pack_generator",
      "azure_boards_ai_portfolio_fitness_index",
      "azure_boards_ai_elicit_requirements",
      "azure_boards_ai_requirement_gap_analysis",
      "azure_boards_ai_transform_work_item_text",
      "azure_boards_ai_convert_requirement",
      "azure_boards_ai_generate_test_cases",
      "azure_boards_ai_generate_uat_suite",
      "azure_boards_ai_generate_regression_suite",
      "azure_boards_ai_requirement_test_traceability",
      "azure_boards_ai_test_coverage_analysis",
      "azure_boards_ai_defect_traceability",
      "azure_boards_ai_generate_mockup",
      "azure_boards_ai_generate_diagram",
      "azure_boards_ai_generate_sop_document",
      "azure_boards_prompt_save",
      "azure_boards_prompt_list",
      "azure_boards_prompt_run",
      "azure_boards_prompt_delete",
      "azure_boards_admin_get_config",
      "azure_boards_admin_validate_config",
      "azure_boards_apply_test_case_plan",
      "azure_boards_apply_traceability_plan",
      "azure_boards_ai_decision_memory",
      "azure_boards_ai_recommendation_quality_score",
      "azure_boards_ai_value_inflation_detector",
      "azure_boards_ai_decision_court",
      "azure_boards_ai_requirement_contract_lifecycle",
      "azure_boards_ai_scenario_war_room",
      "azure_boards_ai_autonomous_governance_agent",
      "azure_boards_ai_business_digital_twin",
      "azure_boards_ai_external_evidence_import",
      "azure_boards_ai_event_log_process_mining",
      "azure_boards_ai_stakeholder_influence_map",
      "azure_boards_ai_roi_confidence_workflow",
      "azure_boards_ai_enterprise_risk_heatmap",
      "azure_boards_ai_policy_studio",
      "azure_boards_ai_prompt_eval_suite",
      "azure_boards_ai_model_risk_governance",
      "azure_boards_ai_adoption_cockpit",
      "azure_boards_ai_connector_readiness_audit",
      "azure_boards_ai_evidence_ingestion_pipeline",
      "azure_boards_ai_security_privacy_review",
      "azure_boards_ai_marketplace_submission_readiness",
      "azure_boards_ai_org_rollout_readiness",
      "azure_boards_ai_license_packaging_advisor",
      "azure_boards_ai_customer_value_case_builder",
      "azure_boards_ai_proprietary_signal_catalog",
      "azure_boards_ai_autonomous_followup_scheduler",
      "azure_boards_ai_adoption_experiment_designer",
      "azure_boards_product_snapshot_save",
      "azure_boards_product_baseline_save",
      "azure_boards_product_approval_queue",
      "azure_boards_product_approval_apply_plan",
      "azure_boards_product_approval_result_review",
      "azure_boards_product_audit_trail",
      "azure_boards_product_role_cockpits",
      "azure_boards_product_admin_console",
      "azure_boards_product_reminder_plan",
      "azure_boards_product_decision_pack_export",
      "azure_boards_product_decision_pack_import"
    ];
    const missing = expectedTools.filter((name) => !names.includes(name));
    assert.deepEqual(missing, [], `Expected MCP tools to be listed: ${expectedTools.join(", ")}`);

    for (const tool of listed.result.tools) {
      assert.deepEqual(
        Object.keys(tool.annotations).sort(),
        ["destructiveHint", "openWorldHint", "readOnlyHint"],
        `${tool.name} should expose explicit ChatGPT Apps tool annotations`
      );
      assert.equal(typeof tool.annotations.readOnlyHint, "boolean", `${tool.name} readOnlyHint should be boolean`);
      assert.equal(typeof tool.annotations.openWorldHint, "boolean", `${tool.name} openWorldHint should be boolean`);
      assert.equal(typeof tool.annotations.destructiveHint, "boolean", `${tool.name} destructiveHint should be boolean`);
      assert.deepEqual(tool.outputSchema, {
        type: "object",
        additionalProperties: true
      });
    }

    const byName = new Map(listed.result.tools.map((tool) => [tool.name, tool]));
    assert.deepEqual(byName.get("azure_boards_query_work_items").annotations, {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false
    });
    assert.deepEqual(byName.get("azure_boards_store_save").annotations, {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false
    });
    assert.deepEqual(byName.get("azure_boards_update_work_item").annotations, {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false
    });
    assert.deepEqual(byName.get("azure_boards_store_delete").annotations, {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: true
    });
    assert.deepEqual(byName.get("azure_boards_apply_bulk_close_plan").annotations, {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: true
    });
  } finally {
    child.kill();
    await once(child, "exit");
  }
});

test("ChatGPT app submission metadata covers every runtime tool with matching annotations", async () => {
  const tools = await listRuntimeTools();
  const submissionPath = path.resolve(process.cwd(), "..", "chatgpt-app-submission.json");
  const submission = JSON.parse(readFileSync(submissionPath, "utf8"));
  const submittedTools = submission.tools || {};

  assert.deepEqual(
    Object.keys(submittedTools).sort(),
    tools.map((tool) => tool.name).sort(),
    "chatgpt-app-submission.json should cover every exposed MCP tool"
  );

  for (const tool of tools) {
    assert.deepEqual(
      submittedTools[tool.name].annotations,
      tool.annotations,
      `${tool.name} submission annotations should match runtime annotations`
    );
  }
});

test("MCP tool calls return structured content alongside text content", async () => {
  const child = spawn(process.execPath, ["dist/server.js"], { stdio: ["pipe", "pipe", "pipe"] });
  try {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
    await readLine(child.stdout);

    child.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "azure_boards_auth_environment_check", arguments: {} }
      }) + "\n"
    );

    const response = JSON.parse((await readLine(child.stdout)).trim());
    assert.equal(response.error, undefined);
    assert.equal(typeof response.result.structuredContent, "object");
    assert.match(response.result.content[0].text, /configured/);
  } finally {
    child.kill();
    await once(child, "exit");
  }
});

async function listRuntimeTools() {
  const child = spawn(process.execPath, ["dist/server.js"], { stdio: ["pipe", "pipe", "pipe"] });
  try {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
    await readLine(child.stdout);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
    const listed = JSON.parse((await readLine(child.stdout)).trim());
    return listed.result.tools;
  } finally {
    child.kill();
    await once(child, "exit");
  }
}

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
