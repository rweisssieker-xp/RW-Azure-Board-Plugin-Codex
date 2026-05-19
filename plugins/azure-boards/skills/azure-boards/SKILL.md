---
name: azure-boards
description: Use Azure Boards through Microsoft Entra OAuth, PAT, or bearer-token auth for Work Item operations, AI Project Cockpit reporting, history/flow mining, comment intelligence, role-based delivery reports, process policy checks, and safe write-preview workflows.
---

# Azure Boards

Use this skill when the user wants to work with Azure DevOps Boards, Work Items, project delivery status, process compliance, delivery risk, bottlenecks, comments, role-specific reporting, governance, or process policy analysis.

## Authentication Guidance

1. Prefer the active configured mode reported by `azure_boards_auth_status`.
2. Use PAT mode when `AZURE_BOARDS_PAT` or `AZURE_DEVOPS_PAT` is configured.
3. Use existing bearer-token mode when `AZURE_BOARDS_BEARER_TOKEN` is configured.
4. Use Microsoft Entra OAuth device login when token env vars are not configured and user login is appropriate. Call `azure_boards_login` before data access.
5. Never print tokens, PATs, bearer tokens, device-code secrets, or token-cache contents.

## Workflow

1. Check authentication with `azure_boards_auth_status`; call `azure_boards_login` only when OAuth login is needed.
2. Use `azure_boards_query_work_items` or `azure_boards_get_work_item` to gather board truth before making recommendations.
3. Prefer explainable AI/KI tools for process and delivery insights, especially:
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
16. For WSJF and business-value reviews, compare `Custom.BusinessValue`, `Custom.TimeCriticality`, `Custom.RiskReduction`, `Custom.CostOfDelay`, and `Custom.JobDuration` against Description, attachments, status, priority, children, and aging. Treat Euro values as conservative estimates and state assumptions.
17. For attachment-backed decisions, use `azure_boards_ai_attachment_evidence_summary` with extracted text when available. `docx`, `xlsx/xlsm`, `pdf`, `xml`, `csv`, and `txt` are usually useful; `.msg` and images are evidence metadata unless OCR/parser support is available.
18. For Requirement Decision Engine work, use `azure_boards_ai_requirement_decision_cockpit` for accelerate/review/park/close support, `azure_boards_ai_evidence_first_requirement_review` for missing evidence, and `azure_boards_ai_cio_requirement_risk_view` for executive risk. These tools support decisions; they do not justify automatic closure by themselves.
19. For portfolio economics, use `azure_boards_ai_portfolio_rationalization`, `azure_boards_ai_benefit_realization_tracking`, `azure_boards_ai_cost_avoidance_by_closure`, and `azure_boards_ai_erp_domain_impact_scoring`. State assumptions for Euro, cost, benefit, and domain-impact estimates.
20. For audit and governance work, use `azure_boards_ai_closure_governance_ledger`, `azure_boards_ai_audit_decision_log`, `azure_boards_ai_board_hygiene_automation_preview`, and `azure_boards_ai_evidence_pack_completeness`. Distinguish actual Azure Boards evidence from inferred governance status and never fabricate evidence ledger entries.
21. For outcome and CIO steering work, use `azure_boards_ai_outcome_realization_cockpit`, `azure_boards_ai_business_case_generator`, `azure_boards_ai_value_leakage_detector`, `azure_boards_ai_board_due_diligence_report`, and `azure_boards_ai_steering_committee_pack`. Treat generated business cases and packs as drafts requiring human review.
22. For traceability and process criticality, use `azure_boards_ai_decision_traceability_graph`, `azure_boards_ai_erp_process_criticality_model`, `azure_boards_ai_requirement_invest_divest_matrix`, `azure_boards_ai_change_portfolio_simulator`, and `azure_boards_ai_policy_as_code_evaluation`. Separate simulated closure effects from actual board state.
23. For write operations, show the proposed field changes or JSON Patch first unless the user explicitly requested the exact write.

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
- Treat AI/KI scores as decision support, not as authoritative process compliance findings.
- For executive summaries, include risks, evidence, and next actions grounded in Work Item fields, comments, and relations.
- For comment intelligence, distinguish direct evidence from inferred intent or sentiment.
- For role-based reports, avoid hiding uncertainty. Include missing data and policy/config assumptions.
- For process policy checks, do not treat local defaults as organization policy unless the user or config says so.
- Use `azure_boards_package_health` and `azure_boards_auth_environment_check` for diagnostics, but do not ask the user to paste secret values.
- Use `azure_boards_ai_plan_approved_actions` only after explicit approval; it prepares batches but still does not perform Azure DevOps writes.
- Use `azure_boards_apply_bulk_close_plan` only for a preview generated by `azure_boards_ai_bulk_close_preview`; never construct hidden bulk writes.
- Treat decision, portfolio, CIO, steering-pack, policy-as-code, and evidence-ledger tools as advisory no-write tools. They can recommend, rank, simulate, and export evidence previews, but only explicit write tools may change Azure Boards.
- Do not store PATs, bearer tokens, OAuth token caches, or live attachment extraction artifacts in plugin docs or local JSON reports.
- Remember Azure DevOps process quirks: Work Item comments use `7.1-preview`, and Work Item batch fetches should not combine explicit fields with relation expansion.
