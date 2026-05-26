---
name: azure-boards
description: Use Azure Boards through Microsoft Entra OAuth, PAT, or bearer-token auth for Work Item operations, AI Project Cockpit reporting, history/flow mining, comment intelligence, role-based delivery reports, process policy checks, and safe write-preview workflows.
---

# Azure Boards

Use this skill when the user wants to work with Azure DevOps Boards, Work Items, project delivery status, process compliance, delivery risk, bottlenecks, comments, role-specific reporting, governance, or process policy analysis.

## App Directory Review Notes

When preparing this plugin for OpenAI App Directory review, keep submission metadata conservative and evidence-backed:

1. Do not publish example support addresses, local repository URLs, development-only URLs, or Microsoft-owned documentation URLs as app-owned support, repository, privacy, terms, or website links.
2. Use `TODO_SUBMISSION_*` placeholders only in pre-submission artifacts when the real owned URL or support contact is not known.
3. Do not fabricate privacy policy or terms URLs. Require publisher-owned privacy and terms pages before final submission.
4. Prefer individual Microsoft Entra login for app review. PAT and bearer-token modes are development or controlled automation options and must not require users to paste secrets into ChatGPT.
5. Confirm deployed MCP transport, OAuth registration, support contact, privacy policy, terms, screenshots, tool annotations, and output schemas before claiming App Directory readiness.

## Authentication Guidance

1. Prefer the active configured mode reported by `azure_boards_auth_status`.
2. Use PAT mode when `AZURE_BOARDS_PAT` or `AZURE_DEVOPS_PAT` is configured.
3. Use existing bearer-token mode when `AZURE_BOARDS_BEARER_TOKEN` is configured.
4. Use Microsoft Entra OAuth device login when token env vars are not configured and user login is appropriate. Call `azure_boards_login` before data access.
5. Never print tokens, PATs, bearer tokens, device-code secrets, or token-cache contents.

## Workflow

1. Check authentication with `azure_boards_auth_status`; call `azure_boards_login` only when OAuth login is needed.
2. Use `azure_boards_query_work_items` or `azure_boards_get_work_item` to gather board truth before making recommendations.
3. Prefer explainable AI tools for process and delivery insights, especially:
   - `azure_boards_ai_delivery_risk_radar`
   - `azure_boards_ai_project_cockpit`
   - `azure_boards_ai_watchlist_report`
   - `azure_boards_ai_action_plan`
   - `azure_boards_ai_workflow_conformance`
   - `azure_boards_ai_sla_aging_monitor`
   - `azure_boards_ai_bottleneck_mining`
   - `azure_boards_ai_governance_score`
   - `azure_boards_ai_policy_gap_detector`
   - `azure_boards_ai_create_process_baseline`
   - `azure_boards_ai_process_drift_detection`
   - `azure_boards_ai_cost_of_delay_radar`
   - `azure_boards_ai_process_simulator`
   - `azure_boards_ai_capacity_forecast`
   - `azure_boards_ai_brief_export`
   - `azure_boards_ai_delivery_system_correlation`
   - `azure_boards_ai_wsjf_consistency_check`
   - `azure_boards_ai_business_value_estimate`
   - `azure_boards_ai_attachment_evidence_summary`
   - `azure_boards_ai_close_candidates`
   - `azure_boards_ai_parent_child_cleanup`
   - `azure_boards_ai_bulk_close_preview`
   - `azure_boards_ai_requirement_decision_cockpit`
   - `azure_boards_ai_evidence_first_requirement_review`
   - `azure_boards_ai_cio_requirement_risk_view`
   - `azure_boards_ai_portfolio_rationalization`
   - `azure_boards_ai_benefit_realization_tracking`
   - `azure_boards_ai_cost_avoidance_by_closure`
   - `azure_boards_ai_erp_domain_impact_scoring`
   - `azure_boards_ai_closure_governance_ledger`
   - `azure_boards_ai_audit_decision_log`
   - `azure_boards_ai_board_hygiene_automation_preview`
   - `azure_boards_ai_evidence_pack_completeness`
   - `azure_boards_ai_outcome_realization_cockpit`
   - `azure_boards_ai_business_case_generator`
   - `azure_boards_ai_value_leakage_detector`
   - `azure_boards_ai_decision_traceability_graph`
   - `azure_boards_ai_erp_process_criticality_model`
   - `azure_boards_ai_board_due_diligence_report`
   - `azure_boards_ai_requirement_invest_divest_matrix`
   - `azure_boards_ai_change_portfolio_simulator`
   - `azure_boards_ai_steering_committee_pack`
   - `azure_boards_ai_policy_as_code_evaluation`
   - `azure_boards_ai_autonomous_board_auditor`
   - `azure_boards_ai_requirement_rewrite_studio`
   - `azure_boards_ai_decision_meeting_copilot`
   - `azure_boards_ai_cleanup_campaign_manager`
   - `azure_boards_ai_financial_backlog_ledger`
   - `azure_boards_ai_requirement_confidence_score`
   - `azure_boards_ai_dependency_blocker_graph`
   - `azure_boards_ai_process_owner_control_tower`
   - `azure_boards_ai_migration_cutover_readiness`
   - `azure_boards_ai_exception_register`
   - `azure_boards_ai_benefit_realization_followup`
   - `azure_boards_ai_operating_rhythm_planner`
   - `azure_boards_ai_okr_alignment_scorer`
   - `azure_boards_ai_compliance_readiness_review`
   - `azure_boards_ai_handover_pack_generator`
   - `azure_boards_ai_portfolio_fitness_index`
   - `azure_boards_ai_elicit_requirements`
   - `azure_boards_ai_requirement_gap_analysis`
   - `azure_boards_ai_transform_work_item_text`
   - `azure_boards_ai_convert_requirement`
   - `azure_boards_ai_generate_test_cases`
   - `azure_boards_ai_generate_uat_suite`
   - `azure_boards_ai_generate_regression_suite`
   - `azure_boards_ai_requirement_test_traceability`
   - `azure_boards_ai_test_coverage_analysis`
   - `azure_boards_ai_defect_traceability`
   - `azure_boards_ai_generate_mockup`
   - `azure_boards_ai_generate_diagram`
   - `azure_boards_ai_generate_sop_document`
   - `azure_boards_prompt_save`
   - `azure_boards_prompt_list`
   - `azure_boards_prompt_run`
   - `azure_boards_prompt_delete`
   - `azure_boards_admin_get_config`
   - `azure_boards_admin_validate_config`
   - `azure_boards_ai_decision_memory`
   - `azure_boards_ai_recommendation_quality_score`
   - `azure_boards_ai_value_inflation_detector`
   - `azure_boards_ai_decision_court`
   - `azure_boards_ai_requirement_contract_lifecycle`
   - `azure_boards_ai_scenario_war_room`
   - `azure_boards_ai_autonomous_governance_agent`
   - `azure_boards_ai_business_digital_twin`
   - `azure_boards_ai_external_evidence_import`
   - `azure_boards_ai_event_log_process_mining`
   - `azure_boards_ai_stakeholder_influence_map`
   - `azure_boards_ai_roi_confidence_workflow`
   - `azure_boards_ai_enterprise_risk_heatmap`
   - `azure_boards_ai_policy_studio`
   - `azure_boards_ai_prompt_eval_suite`
   - `azure_boards_ai_model_risk_governance`
   - `azure_boards_ai_adoption_cockpit`
   - `azure_boards_ai_connector_readiness_audit`
   - `azure_boards_ai_evidence_ingestion_pipeline`
   - `azure_boards_ai_security_privacy_review`
   - `azure_boards_ai_marketplace_submission_readiness`
   - `azure_boards_ai_org_rollout_readiness`
   - `azure_boards_ai_license_packaging_advisor`
   - `azure_boards_ai_customer_value_case_builder`
   - `azure_boards_ai_proprietary_signal_catalog`
   - `azure_boards_ai_autonomous_followup_scheduler`
   - `azure_boards_ai_adoption_experiment_designer`
   - `azure_boards_product_snapshot_save`
   - `azure_boards_product_baseline_save`
   - `azure_boards_product_approval_queue`
   - `azure_boards_product_approval_apply_plan`
   - `azure_boards_product_approval_result_review`
   - `azure_boards_product_audit_trail`
   - `azure_boards_product_role_cockpits`
   - `azure_boards_product_admin_console`
   - `azure_boards_product_reminder_plan`
   - `azure_boards_product_decision_pack_export`
   - `azure_boards_product_decision_pack_import`
   - `azure_boards_validate_policy_pack`
   - `azure_boards_ai_synthesize_report`
4. For AI Project Cockpit requests, combine delivery risk, SLA aging, bottleneck, governance, policy, blocker, and next-action signals into one evidence-backed report.
5. For history and flow mining, inspect revisions, state transitions, cycle time, reopen patterns, handoffs, stale work, and blocked periods before recommending process changes.
6. For comment intelligence, ground findings in Work Item comments and discussion history. Extract blockers, commitments, decisions, unresolved questions, escalations, and follow-up actions without overstating sentiment.
7. For role-based reports, tailor the same board truth to the requested audience:
   - Executives: health, risk, dates, decisions needed, and business impact.
   - Product owners: scope movement, priority conflicts, readiness, dependencies, and acceptance gaps.
   - Scrum masters/process owners: flow, aging, WIP, blockers, handoffs, and policy conformance.
   - Engineering/QA leads: technical blockers, defect trends, review/test readiness, and ownership gaps.
   - Compliance/governance: evidence, missing fields, audit risks, and policy exceptions.
8. For process policy config, use explicit thresholds and rules when provided. If no config is supplied, state the default assumptions before scoring SLA, governance, transition, required-field, or evidence checks.
9. For proactive operations, use `azure_boards_ai_watchlist_report` before `azure_boards_ai_action_plan`; the action plan can propose patches, but does not apply them.
10. For baseline/drift work, create or load a baseline first, then compare current board evidence and explain which metric moved beyond threshold.
11. For economic prioritization, use cost-of-delay and capacity forecasts as decision support; include assumptions rather than presenting the score as finance truth.
12. For repo/pipeline correlation, use PR/build/pipeline/release list tools read-only and clearly separate Azure Boards evidence from delivery-system evidence.
13. For policy packs, validate the policy pack first and state whether findings come from user policy, example policy, or defaults.
14. For persistence, store only user-approved reports/baselines/watchdog snapshots in the local store; never store PATs, bearer tokens, API keys, or raw token-cache contents.
15. For optional LLM synthesis, use deterministic reports as the source of truth. Treat LLM output as wording/synthesis only, not as the scoring authority.
16. For WSJF and business-value reviews, compare `Custom.BusinessValue`, `Custom.TimeCriticality`, `Custom.RiskReduction`, `Custom.CostOfDelay`, and `Custom.JobDuration` against Description, attachments, status, priority, children, and aging. Treat EUR-denominated values as conservative estimates and state assumptions.
17. For attachment-backed decisions, use `azure_boards_ai_attachment_evidence_summary` with extracted text when available. `docx`, `xlsx/xlsm`, `pdf`, `xml`, `csv`, and `txt` are usually useful; `.msg` and images are evidence metadata unless OCR/parser support is available.
18. For Requirement Decision Engine work, use `azure_boards_ai_requirement_decision_cockpit` for accelerate/review/park/close support, `azure_boards_ai_evidence_first_requirement_review` for missing evidence, and `azure_boards_ai_cio_requirement_risk_view` for executive risk. These tools support decisions; they do not justify automatic closure by themselves.
19. For portfolio economics, use `azure_boards_ai_portfolio_rationalization`, `azure_boards_ai_benefit_realization_tracking`, `azure_boards_ai_cost_avoidance_by_closure`, and `azure_boards_ai_erp_domain_impact_scoring`. State assumptions for EUR-denominated cost, benefit, and domain-impact estimates.
20. For audit and governance work, use `azure_boards_ai_closure_governance_ledger`, `azure_boards_ai_audit_decision_log`, `azure_boards_ai_board_hygiene_automation_preview`, and `azure_boards_ai_evidence_pack_completeness`. Distinguish actual Azure Boards evidence from inferred governance status and never fabricate evidence ledger entries.
21. For outcome and CIO steering work, use `azure_boards_ai_outcome_realization_cockpit`, `azure_boards_ai_business_case_generator`, `azure_boards_ai_value_leakage_detector`, `azure_boards_ai_board_due_diligence_report`, and `azure_boards_ai_steering_committee_pack`. Treat generated business cases and packs as drafts requiring human review.
22. For traceability and process criticality, use `azure_boards_ai_decision_traceability_graph`, `azure_boards_ai_erp_process_criticality_model`, `azure_boards_ai_requirement_invest_divest_matrix`, `azure_boards_ai_change_portfolio_simulator`, and `azure_boards_ai_policy_as_code_evaluation`. Separate simulated closure effects from actual board state.
23. For Governance Operating System work, use `azure_boards_ai_autonomous_board_auditor`, `azure_boards_ai_requirement_rewrite_studio`, `azure_boards_ai_decision_meeting_copilot`, `azure_boards_ai_cleanup_campaign_manager`, `azure_boards_ai_financial_backlog_ledger`, `azure_boards_ai_requirement_confidence_score`, `azure_boards_ai_dependency_blocker_graph`, `azure_boards_ai_process_owner_control_tower`, `azure_boards_ai_migration_cutover_readiness`, `azure_boards_ai_exception_register`, `azure_boards_ai_benefit_realization_followup`, `azure_boards_ai_operating_rhythm_planner`, `azure_boards_ai_okr_alignment_scorer`, `azure_boards_ai_compliance_readiness_review`, `azure_boards_ai_handover_pack_generator`, and `azure_boards_ai_portfolio_fitness_index`. Treat rewrite suggestions, cleanup campaigns, cutover readiness, exception registers, benefit follow-ups, handover packs, strategic alignment scores, compliance readiness checks, and portfolio fitness scores as advisory previews until the user explicitly approves concrete writes.
24. For elicitation, conversion, test generation, traceability, mockup, diagram, SOP, prompt, and admin work, use the Copilot4DevOps gap-closure tools. Treat generated Requirements, test cases, UAT/regression suites, links, mockups, diagrams, SOPs, prompt runs, and admin configs as drafts or previews until explicitly approved.
25. For CIO decision assurance and autonomous Process Owner work, use `azure_boards_ai_decision_memory`, `azure_boards_ai_recommendation_quality_score`, `azure_boards_ai_value_inflation_detector`, `azure_boards_ai_decision_court`, `azure_boards_ai_requirement_contract_lifecycle`, `azure_boards_ai_scenario_war_room`, and `azure_boards_ai_autonomous_governance_agent`. Treat decision memory, recommendation learning, value inflation, decision court, contracts, scenarios, watchlists, agenda items, and action previews as advisory until explicitly approved.
26. For Enterprise Value & Trust work, use `azure_boards_ai_business_digital_twin`, `azure_boards_ai_external_evidence_import`, `azure_boards_ai_event_log_process_mining`, `azure_boards_ai_stakeholder_influence_map`, `azure_boards_ai_roi_confidence_workflow`, `azure_boards_ai_enterprise_risk_heatmap`, `azure_boards_ai_policy_studio`, `azure_boards_ai_prompt_eval_suite`, `azure_boards_ai_model_risk_governance`, and `azure_boards_ai_adoption_cockpit`. Treat external evidence, process logs, KPI links, stakeholder maps, ROI maturity, heatmaps, policies, prompt evals, model risk, and adoption metrics as decision-support evidence, not as authoritative truth without review.
27. For enterprise productization and data-moat work, use `azure_boards_ai_connector_readiness_audit`, `azure_boards_ai_evidence_ingestion_pipeline`, `azure_boards_ai_security_privacy_review`, `azure_boards_ai_marketplace_submission_readiness`, `azure_boards_ai_org_rollout_readiness`, `azure_boards_ai_license_packaging_advisor`, `azure_boards_ai_customer_value_case_builder`, `azure_boards_ai_proprietary_signal_catalog`, `azure_boards_ai_autonomous_followup_scheduler`, and `azure_boards_ai_adoption_experiment_designer`. Treat connector readiness, marketplace checklists, security/privacy controls, commercial packaging, signal catalogs, follow-ups, and adoption experiments as rollout planning evidence, not as deployment or scheduling actions.
28. For product operating system work, use `azure_boards_product_snapshot_save`, `azure_boards_product_baseline_save`, `azure_boards_product_approval_queue`, `azure_boards_product_approval_apply_plan`, `azure_boards_product_approval_result_review`, `azure_boards_product_audit_trail`, `azure_boards_product_role_cockpits`, `azure_boards_product_admin_console`, `azure_boards_product_reminder_plan`, `azure_boards_product_decision_pack_export`, and `azure_boards_product_decision_pack_import`. Treat snapshots, baselines, approval queues, apply plans, result reviews, audit trails, role cockpit configs, reminders, and decision packs as local product artifacts or no-write previews until the user explicitly approves a concrete Azure DevOps write.
29. For write operations, show the proposed field changes or JSON Patch first unless the user explicitly requested the exact write.

## Safe Write-Preview Workflow

Use write-preview behavior for any create, update, comment, relation, assignment, state transition, tag, area, iteration, or policy-remediation action:

1. Gather the current Work Item data.
2. Produce a preview containing Work Item ids, fields or relations affected, old values, proposed values, and rationale.
3. Ask for confirmation when the requested write is not already explicit and exact.
4. Execute only the write-specific tool after confirmation.
5. Report completed changes, skipped changes, and Azure DevOps errors.

For bulk close work:

1. Always re-read current state, type, direct children, and parent relations before planning.
2. Use `azure_boards_ai_bulk_close_preview` before writing; it must include ids, current states, target states, child impact, comments, JSON Patch previews, skipped items, and risk.
3. Use `azure_boards_apply_bulk_close_plan` only when the preview is explicitly approved with `approved:true` and `confirmPhrase: "APPLY_BULK_CLOSE"`.
4. Write the explanatory comment before the state transition.
5. After applying, re-query the relevant WIQL and report remaining counts.

## Guardrails

- Do not invent project status. Use Azure Boards data or clearly label assumptions.
- Do not auto-assign owners, change states, or create audit evidence without user confirmation.
- Treat AI scores as decision support, not as authoritative process compliance findings.
- For executive summaries, include risks, evidence, and next actions grounded in Work Item fields, comments, and relations.
- For comment intelligence, distinguish direct evidence from inferred intent or sentiment.
- For role-based reports, avoid hiding uncertainty. Include missing data and policy/config assumptions.
- For process policy checks, do not treat local defaults as organization policy unless the user or config says so.
- Use `azure_boards_package_health` and `azure_boards_auth_environment_check` for diagnostics, but do not ask the user to paste secret values.
- Use `azure_boards_ai_plan_approved_actions` only after explicit approval; it prepares batches but still does not perform Azure DevOps writes.
- Use `azure_boards_apply_bulk_close_plan` only for a preview generated by `azure_boards_ai_bulk_close_preview`; never construct hidden bulk writes.
- Use `azure_boards_apply_test_case_plan` only for a preview generated by `azure_boards_ai_generate_test_cases`; require `approved:true` and `confirmPhrase: "APPLY_TEST_CASE_PLAN"`.
- Use `azure_boards_apply_traceability_plan` only for a preview generated by `azure_boards_ai_requirement_test_traceability`; require `approved:true` and `confirmPhrase: "APPLY_TRACEABILITY_PLAN"`.
- Treat decision, portfolio, CIO, steering-pack, policy-as-code, evidence-ledger, and Governance Operating System tools as advisory no-write tools. They can recommend, rank, simulate, draft rewrite patches, and export evidence previews, but only explicit write tools may change Azure Boards.
- Do not store PATs, bearer tokens, OAuth token caches, or live attachment extraction artifacts in plugin docs or local JSON reports.
- Remember Azure DevOps process quirks: Work Item comments use `7.1-preview`, and Work Item batch fetches should not combine explicit fields with relation expansion.
