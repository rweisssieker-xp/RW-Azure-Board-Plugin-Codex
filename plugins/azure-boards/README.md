# Azure Boards Codex Plugin

Repo-local Codex plugin for Azure Boards with individual Microsoft Entra login or token access, Work Item operations, and explainable AI/KI tools for delivery and process management.

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

## Verify Auth Mode

Call `azure_boards_auth_status` to see whether the server is using PAT, bearer token, OAuth cache, or device-code OAuth setup.

## Authentication Modes

The plugin supports three explicit authentication modes so teams can choose the least privileged option that fits their environment:

- `AZURE_BOARDS_PAT`: Azure DevOps Personal Access Token mode. Use for local development or controlled automation where a PAT can be scoped and rotated. This takes precedence over all other modes.
- `AZURE_BOARDS_BEARER_TOKEN`: Existing bearer-token mode. Use when another identity system or CI job already provides an Azure DevOps-compatible access token. This takes precedence over OAuth cache mode.
- Microsoft Entra OAuth device login: Individual user login mode. Configure `AZURE_BOARDS_CLIENT_ID`, optionally `AZURE_BOARDS_TENANT_ID`, `AZURE_BOARDS_SCOPES`, and `AZURE_BOARDS_TOKEN_CACHE`, then run `azure_boards_login`.

Use `azure_boards_auth_status` before troubleshooting access issues. It reports the active mode without exposing secrets.

## AI/KI Feature Areas

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
- **Safe write-preview workflow**: change-producing tools must show a proposed JSON Patch or field-level preview before any write is executed.

## Safe Write-Preview Workflow

Read and analysis tools may run directly after authentication. Any workflow that could create or update Azure Boards data should follow this sequence:

1. Gather current Work Item data with query/get tools.
2. Generate a preview that lists target Work Items, fields, old values, new values, and rationale.
3. Ask for explicit user confirmation when the user has not already requested the exact write.
4. Call the write-specific tool only after confirmation.
5. Summarize what changed, what was skipped, and any errors returned by Azure DevOps.

Previews should be concrete enough for audit and review. They should not hide state transitions, owner changes, iteration changes, tags, comments, or relation edits behind a generic "update item" label.

## Safety Model

AI/KI tools are explainable and assistive. Tools that propose Work Item changes return patch previews and do not write unless a write-specific tool is called.
