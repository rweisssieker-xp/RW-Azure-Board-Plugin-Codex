# Azure Board Plugin Codex

Codex plugin workspace for Azure Board Plugin Codex, an Azure Boards MCP integration. The main plugin lives in `plugins/azure-boards` and provides Azure DevOps Work Item access, deterministic governance analytics, product operating workflows, a static review UI, hosted MCP deployment support, and production-readiness checks.

## Repository Layout

- `plugins/azure-boards/`: Azure Board Plugin Codex package.
- `plugins/azure-boards/scripts/`: TypeScript MCP server, hosted HTTP MCP server, tests, and release checks.
- `plugins/azure-boards/ui/`: Static no-write review cockpit for local screenshots and demos.
- `plugins/azure-boards/docs/`: Production readiness, hosted MCP deployment, privacy policy, terms, release handoff, and completion audit.
- `plugins/azure-boards/demo/`: Sanitized ERP and Azure Boards demo data.
- `plugins/azure-boards/assets/screenshots/`: App listing screenshots.

## Key Features

- Persistent snapshots and process baselines.
- Approval queue with review, selection, apply-plan preview, and result verification.
- Reminder plans for watchlists and benefit follow-ups.
- Audit trail for accepted, rejected, overridden, and recorded recommendations.
- Role cockpits for Product Owner, Scrum Master, CIO, and Compliance.
- Admin configuration for policies, thresholds, risk weights, data classes, LLM mode, hosted MCP, and OAuth readiness.
- Decision Pack import/export with Steering Pack, Audit Pack, Handover Pack, and Operating Rhythm sections.
- Hosted MCP transport with `/healthz`, `/mcp`, Dockerfile, and smoke-test tooling.

## Quickstart

```powershell
cd plugins\azure-boards\scripts
npm install
npm test
```

The local MCP server runs over stdio:

```powershell
npm run start
```

The hosted MCP server runs over HTTP JSON-RPC:

```powershell
npm run start:hosted
```

## Local Review UI

Open `plugins/azure-boards/ui/index.html` in a browser. The UI is static and no-write: it does not call Azure DevOps, does not store tokens, and does not apply changes.

Use `plugins/azure-boards/demo/erp-board-demo.json` for sanitized demo data and screenshots.

## Production Readiness

Publisher metadata, GitHub URLs, privacy policy, and terms are configured. The remaining production deployment inputs are:

- Hosted MCP URL.
- Production Microsoft Entra client id.

Run the production gate from `plugins/azure-boards/scripts`:

```powershell
npm run check:production
```

The gate is expected to fail until the hosted MCP URL and Microsoft Entra client id are replaced with real production values.

## Deployment Handoff

Use `plugins/azure-boards/production-publisher-inputs.example.json` as the template for production values. Keep the real `production-publisher-inputs.json` private; it is ignored by git.

```powershell
cd plugins\azure-boards\scripts
npm run apply:production-inputs -- ..\production-publisher-inputs.json
npm run check:production
npm run smoke:hosted -- https://mcp.example.com/mcp
```

See:

- `plugins/azure-boards/docs/production-readiness.md`
- `plugins/azure-boards/docs/production-gate.md`
- `plugins/azure-boards/docs/hosted-mcp-deployment.md`
- `plugins/azure-boards/docs/release-handoff-checklist.md`

## Submission Artifact

Do not submit the repository root as the plugin artifact. Build the submission package instead:

```powershell
.\tools\New-AzureBoardsPluginSubmission.ps1
```

The generated ZIP is written to `artifacts/azure-board-plugin-codex-submission.zip`. Its root contains `.codex-plugin/plugin.json`, excludes tests and source files that are not needed at runtime, and keeps the file count under the submission scanner limit.

## Safety

Do not commit real `.env` files, token caches, PATs, bearer tokens, Microsoft Entra secrets, or private `production-publisher-inputs.json` files. The root `.gitignore` keeps those local files out of version control while allowing safe example files such as `.env.production.example`.

## Public Project Documents

- `LICENSE`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SUPPORT.md`
- `CHANGELOG.md`
