# Azure Board Plugin Codex Release Handoff Checklist

Use this checklist when moving the plugin from local review to a production publisher submission.

## 1. Publisher Values

- Copy `production-publisher-inputs.example.json` to `production-publisher-inputs.json`.
- Replace every placeholder with production-owned values:
  - support email
  - author URL
  - homepage URL
  - repository or support URL
  - product website URL
  - privacy policy URL
  - terms of service URL
  - hosted MCP URL
  - Microsoft Entra client id
  - Microsoft Entra tenant id or supported tenant selector
- Keep `production-publisher-inputs.json` private. It is ignored by git.

## 2. Apply Metadata

Run from `plugins/azure-boards/scripts`:

```powershell
npm run apply:production-inputs -- ..\production-publisher-inputs.json
```

This updates:

- `.codex-plugin/plugin.json`
- `chatgpt-app-submission.json`

## 3. Hosted MCP

- Deploy the hosted MCP server behind HTTPS on the publisher-owned domain.
- Verify `GET /healthz` returns `status: ok`.
- Verify `POST /mcp` supports JSON-RPC `tools/list`.
- Run `npm run smoke:hosted -- https://mcp.example.com/mcp`.
- Configure production environment variables from `.env.production.example`.
- Store secrets outside the repository and outside generated Decision Packs.

## 4. OAuth

- Register the production Microsoft Entra app.
- Configure delegated Azure DevOps scopes with least privilege.
- Document tenant admin consent and token revocation.
- Verify `azure_boards_auth_status` does not expose token values.

## 5. Product Evidence

- Use `demo/erp-board-demo.json` for sanitized screenshots and review flows.
- Confirm screenshots show decision support, approval preview, apply planning, result review, and evidence/audit artifacts.
- Confirm Decision Pack exports include Steering Pack, Audit Pack, Handover Pack, and Operating Rhythm.

## 6. Final Gates

Run from `plugins/azure-boards/scripts`:

```powershell
npm test
npm run check:production
```

Run from the repository root:

```powershell
python C:\Users\reinerw\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py D:\temp\RW-Azure-Board-Plugin-Codex\plugins\azure-boards
```

Do not submit until all gates pass with the real production deployment values.
