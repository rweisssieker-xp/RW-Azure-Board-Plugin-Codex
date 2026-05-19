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
13. For write operations, show the proposed field changes or JSON Patch first unless the user explicitly requested the exact write.

## Safe Write-Preview Workflow

Use write-preview behavior for any create, update, comment, relation, assignment, state transition, tag, area, iteration, or policy-remediation action:

1. Gather the current Work Item data.
2. Produce a preview containing Work Item ids, fields or relations affected, old values, proposed values, and rationale.
3. Ask for confirmation when the requested write is not already explicit and exact.
4. Execute only the write-specific tool after confirmation.
5. Report completed changes, skipped changes, and Azure DevOps errors.

## Guardrails

- Do not invent project status. Use Azure Boards data or clearly label assumptions.
- Do not auto-assign owners, change states, or create audit evidence without user confirmation.
- Treat AI/KI scores as decision support, not as authoritative process compliance findings.
- For executive summaries, include risks, evidence, and next actions grounded in Work Item fields, comments, and relations.
- For comment intelligence, distinguish direct evidence from inferred intent or sentiment.
- For role-based reports, avoid hiding uncertainty. Include missing data and policy/config assumptions.
- For process policy checks, do not treat local defaults as organization policy unless the user or config says so.
