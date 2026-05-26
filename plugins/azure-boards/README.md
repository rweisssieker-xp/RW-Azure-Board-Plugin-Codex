# Azure Boards Codex Plugin

Repo-local Codex plugin for Azure Boards with individual Microsoft Entra login or token access, Work Item operations, and explainable AI tools for delivery and process management.

## OpenAI App Directory Submission Readiness

Current submission metadata uses the publisher name Reiner Weisssieker, the public GitHub repository, and repository-owned privacy and terms documents. Before App Directory submission, replace the remaining deployment placeholders with real, owned infrastructure values:

- `TODO_DEPLOY_HOSTED_MCP_URL`: reachable HTTPS MCP endpoint for the hosted server.
- `TODO_ENTRA_CLIENT_ID`: production Microsoft Entra app registration client id.

Review notes for OpenAI App Directory readiness:

- The MCP server must be deployed at a reachable production endpoint before submission; local stdio-only usage is not sufficient for a hosted app review.
- Microsoft Entra OAuth requires a production app registration with approved Azure DevOps delegated permissions, redirect/device-flow configuration as applicable, and publisher-owned support documentation.
- PAT and bearer-token modes are useful for local development and controlled automation, but the App Directory review path should prefer individual Microsoft Entra login and should not ask users to paste secrets into ChatGPT.
- Tool descriptors expose explicit Apps SDK annotations (`readOnlyHint`, `openWorldHint`, and `destructiveHint`) and generic object output schemas; `chatgpt-app-submission.json` is generated to cover every runtime tool.
- Screenshots and final app listing copy should show the real app experience, safe write-preview workflow, and authentication state without exposing organization names, Work Item data, tokens, or private board content.

## Setup

### Option A: Microsoft Entra OAuth

Create or reuse a Microsoft Entra public-client app registration that is allowed to request Azure DevOps delegated permissions. Set the client id before starting Codex or the MCP server:

```powershell
$env:AZURE_BOARDS_CLIENT_ID = "<your-entra-app-client-id>"
$env:AZURE_BOARDS_TENANT_ID = "common"
```

Optional:

```powershell
$env:AZURE_BOARDS_SCOPES = "499b84ac-1321-427f-aa17-267ca6975798/.default offline_access openid profile"
$env:AZURE_BOARDS_TOKEN_CACHE = "C:\Users\<you>\AppData\Local\CodexAzureBoards\token-cache.json"
```

Use `azure_boards_login` first. It prints a device login URL and code, then stores a local user-scoped token cache.

### Option B: Azure DevOps Personal Access Token

For token-based access, set a PAT with the minimum required Azure DevOps scopes before starting Codex or the MCP server:

```powershell
$env:AZURE_BOARDS_PAT = "<your-azure-devops-pat>"
```

The server also accepts `AZURE_DEVOPS_PAT` as an alias. PAT auth takes precedence over OAuth when both are configured.

### Option C: Existing Bearer Token

For advanced automation where an Azure DevOps-compatible bearer token is already supplied by another system:

```powershell
$env:AZURE_BOARDS_BEARER_TOKEN = "<access-token>"
```

PAT takes precedence over bearer token, and bearer token takes precedence over the OAuth cache.

## Build

```powershell
cd plugins\azure-boards\scripts
npm install
npm run build
```

## Local Review UI

The plugin includes a static no-write cockpit at `plugins/azure-boards/ui/index.html`.

Use it to paste or upload Work Item JSON, preview key AI reports, inspect tables, review Bulk Close Preview output, and export local Markdown/JSON artifacts. The UI is browser-only: it does not call Azure DevOps, does not handle tokens, and does not perform writes. Real Azure Boards changes still require the MCP preview/apply workflow.

Use `demo/erp-board-demo.json` for sanitized ERP and Azure Boards review scenarios when preparing screenshots, local demos, or App Directory evidence.

## Product Operating System

The plugin now includes productized operating flows in addition to one-off reports:

- `azure_boards_product_snapshot_save`: saves a named board snapshot with baseline, watchlist, role summaries, metrics, and fingerprint.
- `azure_boards_product_baseline_save`: saves a named process baseline for later drift comparison.
- `azure_boards_product_approval_queue`: converts recommendations into a no-write approval queue with risk, selection state, patch preview, and verification steps.
- `azure_boards_product_approval_apply_plan`: turns selected, rejected, or overridden approval rows into an auditable apply plan with secondary-approval handling.
- `azure_boards_product_approval_result_review`: compares apply results and current Work Items so the user can verify outcomes before closing the approval.
- `azure_boards_product_audit_trail`: normalizes accepted, rejected, overridden, or recorded decision events for audit review.
- `azure_boards_product_role_cockpits`: prepares Product Owner, Scrum Master, CIO, and Compliance cockpit configurations.
- `azure_boards_product_admin_console`: validates production admin controls for policies, thresholds, risk weights, data classes, LLM mode, hosted MCP, and OAuth readiness.
- `azure_boards_product_reminder_plan`: prepares recurring watchlist and benefit-realization follow-up recommendations with schedule metadata and automation prompts, without sending or scheduling.
- `azure_boards_product_decision_pack_export`: exports steering, audit, handover, and operating rhythm content as Markdown and JSON-ready Decision Packs with an import/export manifest.
- `azure_boards_product_decision_pack_import`: validates imported Decision Pack artifacts before review or storage.

See `docs/production-readiness.md` for the hosted MCP, Microsoft Entra OAuth, publisher asset, and verification gates required before claiming production readiness.
See `docs/hosted-mcp-deployment.md` for the hosted HTTP MCP endpoint, Dockerfile, `/healthz`, `/mcp`, and smoke-test commands.
Run `npm run check:production` from `plugins/azure-boards/scripts` as the final release gate; it is expected to fail until the hosted MCP URL and production Microsoft Entra client id replace deployment placeholders.

## Verify Auth Mode

Call `azure_boards_auth_status` to see whether the server is using PAT, bearer token, OAuth cache, or device-code OAuth setup.

## Authentication Modes

The plugin supports three explicit authentication modes so teams can choose the least privileged option that fits their environment:

- `AZURE_BOARDS_PAT`: Azure DevOps Personal Access Token mode. Use for local development or controlled automation where a PAT can be scoped and rotated. This takes precedence over all other modes.
- `AZURE_BOARDS_BEARER_TOKEN`: Existing bearer-token mode. Use when another identity system or CI job already provides an Azure DevOps-compatible access token. This takes precedence over OAuth cache mode.
- Microsoft Entra OAuth device login: Individual user login mode. Configure `AZURE_BOARDS_CLIENT_ID`, optionally `AZURE_BOARDS_TENANT_ID`, `AZURE_BOARDS_SCOPES`, and `AZURE_BOARDS_TOKEN_CACHE`, then run `azure_boards_login`.

Use `azure_boards_auth_status` before troubleshooting access issues. It reports the active mode without exposing secrets.

## AI Feature Areas

The Azure Boards plugin is intended to go beyond basic Work Item lookup. The documentation and skill guidance should preserve these user-facing USP areas:

- **AI Project Cockpit**: consolidated project health from Work Item states, aging, blockers, throughput signals, risks, governance indicators, and recommended next actions.
- **History and flow mining**: process mining over Work Item revisions, state transitions, cycle time, handoffs, reopen patterns, stale work, and bottlenecks.
- **Comment intelligence**: extraction of decisions, blockers, commitments, unresolved questions, sentiment/escalation signals, and follow-up actions from Work Item discussion history.
- **Role-based reports**: tailored summaries for executives, product owners, scrum masters, engineering leads, QA, compliance, and process owners, with each report grounded in Work Item evidence.
- **Process policy config**: configurable process rules for SLA thresholds, blocked-state handling, required fields, allowed transitions, risk scoring weights, evidence requirements, and governance checks.
- **Proactive Process Watchdog**: a ranked operational watchlist for stale, blocked, high-impact, unassigned, or policy-risk work via `azure_boards_ai_watchlist_report`.
- **AI Action Plan**: prioritized next actions and JSON Patch previews via `azure_boards_ai_action_plan`; it does not write until a write-specific tool is called.
- **Process baseline and drift detection**: create a local baseline with `azure_boards_ai_create_process_baseline`, then compare current evidence with `azure_boards_ai_process_drift_detection`.
- **Cost of delay radar**: rank economically urgent work with `azure_boards_ai_cost_of_delay_radar` using priority, age, stale time, blocker, risk, and customer-impact signals.
- **What-if process simulator**: simulate WIP, scope, expedite, capacity, and cycle-time changes with `azure_boards_ai_process_simulator`.
- **Capacity and load forecast**: forecast delivery capacity and demand pressure with `azure_boards_ai_capacity_forecast`.
- **Brief export**: turn reports into Markdown or HTML executive, daily-risk, or audit briefs with `azure_boards_ai_brief_export`.
- **Repo and pipeline correlation**: optionally enrich delivery risk with read-only PR, build, pipeline, and release lists via `azure_boards_list_pull_requests`, `azure_boards_list_builds`, `azure_boards_list_pipelines`, and `azure_boards_list_releases`.
- **Delivery-system correlation**: connect Work Items to PR/build/pipeline/release evidence with `azure_boards_ai_delivery_system_correlation`.
- **Policy pack validation**: validate versioned policy packs with `azure_boards_validate_policy_pack`; example packs live in `policy-packs/`.
- **Approved apply planning**: convert approved AI Action Plan items into patch batches with `azure_boards_ai_plan_approved_actions`; it still does not call Azure DevOps.
- **Local persistence**: save/load/list/delete local JSON artifacts with `azure_boards_store_*`, including watchdog snapshots.
- **Optional LLM synthesis**: `azure_boards_ai_synthesize_report` uses deterministic fallback by default and only calls OpenAI when `OPENAI_API_KEY` and `AZURE_BOARDS_LLM_MODE=openai` are set.
- **Package and auth health checks**: `azure_boards_package_health` and `azure_boards_auth_environment_check` help diagnose local setup without returning secret values.
- **Safe write-preview workflow**: change-producing tools must show a proposed JSON Patch or field-level preview before any write is executed.
- **WSJF and business-value governance**: `azure_boards_ai_wsjf_consistency_check` checks WSJF fields against Description signals, `azure_boards_ai_business_value_estimate` provides conservative annual USD-denominated benefit ranges, and `azure_boards_ai_close_candidates` identifies likely closure candidates without writing.
- **Attachment evidence review**: `azure_boards_ai_attachment_evidence_summary` summarizes attachment metadata and optional extracted text snippets so business decisions can cite Description plus supporting documents.
- **Parent/child cleanup**: `azure_boards_ai_parent_child_cleanup` finds open Tasks whose parent Requirement is already terminal.
- **Bulk close preview/apply**: `azure_boards_ai_bulk_close_preview` creates an auditable no-write close plan with comments, patches, child impact, skipped items, and risk. `azure_boards_apply_bulk_close_plan` applies only a generated preview and requires `approved:true` plus `confirmPhrase: "APPLY_BULK_CLOSE"`.
- **Requirement Decision Engine**: `azure_boards_ai_requirement_decision_cockpit`, `azure_boards_ai_evidence_first_requirement_review`, and `azure_boards_ai_cio_requirement_risk_view` turn board evidence into accelerate/review/park/close decision support for Product Owners, Project Leads, and CIO review.
- **Portfolio rationalization and benefit realization**: `azure_boards_ai_portfolio_rationalization`, `azure_boards_ai_benefit_realization_tracking`, and `azure_boards_ai_cost_avoidance_by_closure` classify keep/kill/merge/rework decisions, track expected versus realized benefits, and estimate avoided spend from closed or de-scoped work.
- **ERP domain impact scoring**: `azure_boards_ai_erp_domain_impact_scoring` scores Finance, Production, Compliance, Integration, Customer, Master Data, and Automation impact so ERP work can be prioritized by business-process value.
- **Audit/Governance Evidence Ledger**: `azure_boards_ai_closure_governance_ledger`, `azure_boards_ai_audit_decision_log`, `azure_boards_ai_board_hygiene_automation_preview`, and `azure_boards_ai_evidence_pack_completeness` create no-write audit previews, decision logs, hygiene action previews, and evidence completeness scores.
- **Outcome Realization Cockpit**: `azure_boards_ai_outcome_realization_cockpit` compares expected and realized benefits, exposes value gaps, and makes benefit ownership visible after delivery or closure.
- **AI Business Case Generator**: `azure_boards_ai_business_case_generator` creates draft business cases from board evidence with problem, business outcome, cost assumption, risk of not doing, ROI, and recommendation.
- **Value Leakage Detector**: `azure_boards_ai_value_leakage_detector` identifies stale open value, missing owners, weak evidence, and closed items without realized benefit.
- **Decision Traceability Graph**: `azure_boards_ai_decision_traceability_graph` links Work Items, parent/child relations, attachments, supplied evidence, and decision nodes for explainable audit trails.
- **ERP process criticality model**: `azure_boards_ai_erp_process_criticality_model` maps work to Finance Closing, Order-to-Cash, Procure-to-Pay, Manufacturing, Warehouse, Master Data, Regulatory, and Integration Backbone.
- **Board due diligence and steering packs**: `azure_boards_ai_board_due_diligence_report`, `azure_boards_ai_requirement_invest_divest_matrix`, `azure_boards_ai_change_portfolio_simulator`, and `azure_boards_ai_steering_committee_pack` prepare CIO/steering committee decision material without writing.
- **Policy-as-code evaluation**: `azure_boards_ai_policy_as_code_evaluation` evaluates versionable controls for required tags, fields, owner, stale age, and evidence.
- **Governance Operating System**: `azure_boards_ai_autonomous_board_auditor`, `azure_boards_ai_requirement_rewrite_studio`, `azure_boards_ai_decision_meeting_copilot`, `azure_boards_ai_cleanup_campaign_manager`, `azure_boards_ai_financial_backlog_ledger`, `azure_boards_ai_requirement_confidence_score`, `azure_boards_ai_dependency_blocker_graph`, `azure_boards_ai_process_owner_control_tower`, `azure_boards_ai_migration_cutover_readiness`, `azure_boards_ai_exception_register`, `azure_boards_ai_benefit_realization_followup`, `azure_boards_ai_operating_rhythm_planner`, `azure_boards_ai_okr_alignment_scorer`, `azure_boards_ai_compliance_readiness_review`, `azure_boards_ai_handover_pack_generator`, and `azure_boards_ai_portfolio_fitness_index` extend the plugin into audit automation, decision meetings, cleanup campaigns, ERP cutover readiness, exception handling, handovers, operating cadence, strategic alignment, compliance readiness, and financial backlog governance.
- **Copilot4DevOps gap closure**: `azure_boards_ai_elicit_requirements`, `azure_boards_ai_requirement_gap_analysis`, `azure_boards_ai_transform_work_item_text`, `azure_boards_ai_convert_requirement`, `azure_boards_ai_generate_test_cases`, `azure_boards_ai_generate_uat_suite`, `azure_boards_ai_generate_regression_suite`, `azure_boards_ai_requirement_test_traceability`, `azure_boards_ai_test_coverage_analysis`, `azure_boards_ai_defect_traceability`, `azure_boards_ai_generate_mockup`, `azure_boards_ai_generate_diagram`, `azure_boards_ai_generate_sop_document`, prompt tools, admin validation, and approved test/traceability apply tools add elicitation, conversion, testing, traceability, visuals, documents, dynamic prompts, admin controls, and native Azure DevOps extension readiness.
- **Decision assurance and autonomous governance**: `azure_boards_ai_decision_memory`, `azure_boards_ai_recommendation_quality_score`, `azure_boards_ai_value_inflation_detector`, `azure_boards_ai_decision_court`, `azure_boards_ai_requirement_contract_lifecycle`, `azure_boards_ai_scenario_war_room`, and `azure_boards_ai_autonomous_governance_agent` add auditable decision memory, recommendation learning, value-inflation checks, pro/contra decision courts, measurable outcome contracts, management scenario simulation, and recurring governance watchlists.
- **Enterprise Value & Trust Layer**: `azure_boards_ai_business_digital_twin`, `azure_boards_ai_external_evidence_import`, `azure_boards_ai_event_log_process_mining`, `azure_boards_ai_stakeholder_influence_map`, `azure_boards_ai_roi_confidence_workflow`, `azure_boards_ai_enterprise_risk_heatmap`, `azure_boards_ai_policy_studio`, `azure_boards_ai_prompt_eval_suite`, `azure_boards_ai_model_risk_governance`, and `azure_boards_ai_adoption_cockpit` add Board-to-business KPI correlation, external evidence normalization, event-log process mining, stakeholder influence, ROI maturity, enterprise risk, policy simulation, prompt evaluation, model-risk governance, and team adoption analytics.
- **Enterprise Productization & Data Moat Layer**: `azure_boards_ai_connector_readiness_audit`, `azure_boards_ai_evidence_ingestion_pipeline`, `azure_boards_ai_security_privacy_review`, `azure_boards_ai_marketplace_submission_readiness`, `azure_boards_ai_org_rollout_readiness`, `azure_boards_ai_license_packaging_advisor`, `azure_boards_ai_customer_value_case_builder`, `azure_boards_ai_proprietary_signal_catalog`, `azure_boards_ai_autonomous_followup_scheduler`, and `azure_boards_ai_adoption_experiment_designer` prepare hosted enterprise rollout, connector onboarding, safe evidence ingestion, marketplace packaging, pricing tiers, customer value cases, proprietary signal catalogs, follow-up cadences, and adoption experiments without writing to Azure Boards.

## Native Azure DevOps Extension Preview

The `azure-devops-extension/` folder contains a local-first Azure DevOps extension skeleton with Work Item and admin panels. It is intended for productization and marketplace packaging work. The panels accept a configurable MCP backend URL, do not store secrets or attachment content in browser storage, and keep all write paths behind MCP preview/apply tools.

## Policy Packs

Policy packs are versioned JSON files under `policy-packs/`. Built-in examples:

- `scrum.json`
- `kanban.json`
- `audit.json`
- `release-governance.json`

Validate a pack before using it:

```text
azure_boards_validate_policy_pack
```

The validator normalizes defaults, policy rules, severity, remediation metadata, and scope while returning `writePerformed: false`.

## Optional LLM Synthesis

LLM synthesis is opt-in. Without configuration, `azure_boards_ai_synthesize_report` returns a deterministic local summary.

```powershell
$env:AZURE_BOARDS_LLM_MODE = "openai"
$env:OPENAI_API_KEY = "<your-openai-key>"
$env:AZURE_BOARDS_LLM_MODEL = "gpt-4.1-mini"
```

Scores and findings remain generated by deterministic report tools. The LLM is only used to synthesize language from supplied report evidence.

## Live Smoke Test

Optional live verification against a real Azure DevOps project:

```powershell
$env:AZURE_BOARDS_LIVE_ORG = "<organization>"
$env:AZURE_BOARDS_LIVE_PROJECT = "<project>"
npm run test:live
```

The live test is skipped unless both live variables are set.

## Safe Write-Preview Workflow

Read and analysis tools may run directly after authentication. Any workflow that could create or update Azure Boards data should follow this sequence:

1. Gather current Work Item data with query/get tools.
2. Generate a preview that lists target Work Items, fields, old values, new values, and rationale.
3. Ask for explicit user confirmation when the user has not already requested the exact write.
4. Call the write-specific tool only after confirmation.
5. Summarize what changed, what was skipped, and any errors returned by Azure DevOps.

Previews should be concrete enough for audit and review. They should not hide state transitions, owner changes, iteration changes, tags, comments, or relation edits behind a generic "update item" label.

Bulk closure has stricter rules:

1. Re-read the target Work Items live immediately before preparing a plan.
2. Include each current state, target state, comment text, JSON Patch preview, direct child impact, skipped terminal items, and risk.
3. Write comments before state transitions.
4. Close direct child Tasks only when the parent closure rationale explicitly covers them.
5. Apply the plan only through `azure_boards_apply_bulk_close_plan` with `approved:true` and `confirmPhrase: "APPLY_BULK_CLOSE"`.
6. Re-query after applying and report remaining counts.

Decision, portfolio, outcome, steering-pack, policy-as-code, and evidence-ledger tools are advisory/export tools. They must distinguish actual Azure Boards evidence from inferred status, cite assumptions for USD-denominated values, ROI, cost avoidance, and benefit realization, and must not create audit evidence, close Work Items, or change state without the explicit write-preview/apply workflow above.

Operational Azure DevOps notes learned from live use:

- Work Item comment writes use `api-version=7.1-preview`.
- `workitemsbatch` should not combine `fields` with `$expand=relations`; fetch relations with individual `getWorkItem(..., expand: "relations")`.
- PAT, bearer tokens, OAuth tokens, and device-code data must never be printed, stored in local artifacts, or echoed in reports.
- Bugs and custom Work Item types may have process-specific state transitions; if `Closed` fails, inspect valid states or use the process-allowed intermediate state rather than forcing writes.

## Safety Model

AI tools are explainable and assistive. Tools that propose Work Item changes return patch previews and do not write unless a write-specific tool is called.
