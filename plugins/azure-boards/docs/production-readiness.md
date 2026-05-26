# Azure Boards Production Readiness

This plugin is production-oriented when the local development defaults are replaced with owned publisher assets, a hosted MCP transport, and a production Microsoft Entra app registration.

## Product Features

- Persistent snapshots and baselines: `azure_boards_product_snapshot_save` and `azure_boards_product_baseline_save` store named board state, baseline metrics, watchlist findings, role summaries, and fingerprints in the user-local store.
- Approval queue: `azure_boards_product_approval_queue` converts recommendations into pending review rows with selection defaults, risk level, patch preview, and verification steps.
- Approval apply and verification: `azure_boards_product_approval_apply_plan` records selected, rejected, and overridden rows as a no-write apply plan, while `azure_boards_product_approval_result_review` checks apply results against current Work Items before an approval is closed.
- Audit trail: `azure_boards_product_audit_trail` records accepted, rejected, overridden, or recorded recommendation decisions with actor, rationale, evidence, and outcome status.
- Role cockpits: `azure_boards_product_role_cockpits` prepares Product Owner, Scrum Master, CIO, and Compliance views from the same board data.
- Admin console model: `azure_boards_product_admin_console` normalizes policy, threshold, risk-weight, data-class, LLM-mode, hosted MCP, and OAuth readiness settings.
- Reminder plan: `azure_boards_product_reminder_plan` prepares recurring watchlist and benefit-realization follow-up recommendations with suggested schedule metadata and automation prompts. It does not send messages or schedule by itself.
- Decision packs: `azure_boards_product_decision_pack_export` combines steering, audit, handover, and operating rhythm sections into JSON and Markdown artifacts with an import/export manifest. `azure_boards_product_decision_pack_import` validates imported packs before reuse.

## Hosted MCP Path

For local use, `.mcp.json` starts `node ./scripts/dist/server.js` over stdio. For App Directory review or enterprise rollout, deploy the hosted HTTP MCP server with `npm run start:hosted` or `Dockerfile`, put it behind an authenticated HTTPS endpoint, and set the production URL in the admin configuration:

```json
{
  "hostedMcpUrl": "https://your-owned-domain.example/mcp",
  "llmMode": "deterministic-local"
}
```

Use `.env.production.example` as the deployment configuration template. Do not commit real client ids, tenant-specific secrets, PATs, bearer tokens, or token-cache paths.

See `docs/hosted-mcp-deployment.md` for `/healthz`, `/mcp`, container, and smoke-test commands.
Run `npm run check:production` from `scripts/` before submission. The gate fails until publisher-owned URLs and contacts replace development placeholders; see `docs/production-gate.md`.

The hosted deployment must provide:

- TLS with an owned domain.
- Per-user authorization and tenant isolation.
- Health checks for readiness and dependency status.
- Secret handling outside request logs and local artifacts.
- Audit logging for login, approval, apply, override, and export events.

## Microsoft Entra OAuth

Production review should use individual Microsoft Entra login, not pasted PATs. Configure:

- A publisher-owned Microsoft Entra public-client or confidential app registration appropriate to the hosted transport.
- Azure DevOps delegated permissions with least privilege for read and write workflows.
- Admin consent guidance for enterprise tenants.
- Token storage outside plugin docs, reports, screenshots, and exported artifacts.
- A support page explaining device-code or browser login, revocation, and troubleshooting.

## Publisher Assets Required

Replace all development placeholders before claiming App Directory or marketplace readiness:

- Support email.
- Product website.
- Repository or support URL.
- Privacy policy covering Azure DevOps data, comments, attachments metadata, token handling, local store, optional OpenAI use, and support handling.
- Terms of service covering generated decision support, write approvals, user responsibility, and audit logs.
- Screenshots showing decision, preview, approval, apply, and verification flows without private customer data.

Use `production-publisher-inputs.example.json` as the handoff template for the publisher-owned values. After creating a private `production-publisher-inputs.json`, run this from `plugins/azure-boards/scripts`:

```powershell
npm run apply:production-inputs -- ..\production-publisher-inputs.json
npm run check:production
```

Do not commit the private input file if it contains tenant-specific identifiers that should remain internal.

## Verification Gates

Run these before release:

```powershell
cd plugins\azure-boards\scripts
npm test
python C:\Users\reinerw\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py D:\temp\RW-Azure-Board-Plugin-Codex\plugins\azure-boards
```

Use `demo/erp-board-demo.json` for screenshots and local UI review. Use live Azure DevOps smoke tests only with a non-production project or a tightly controlled test project.
