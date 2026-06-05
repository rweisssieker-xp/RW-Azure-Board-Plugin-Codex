# Hosted MCP Deployment

The plugin supports two runtime modes:

- Local stdio MCP: `npm start`
- Hosted HTTP JSON-RPC MCP: `npm run start:hosted`

## Local Hosted Smoke Test

```powershell
cd scripts
npm run build
$env:AZURE_BOARDS_MCP_HOST = "127.0.0.1"
$env:AZURE_BOARDS_MCP_PORT = "3000"
npm run start:hosted
```

Health:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/healthz
```

List tools:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/mcp -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Automated smoke test:

```powershell
npm run smoke:hosted -- http://127.0.0.1:3000
npm run smoke:hosted -- http://127.0.0.1:3000/mcp
```

## Container

Build from the repository root:

```powershell
docker build -t azure-boards-mcp .
docker run --rm -p 3000:3000 --env-file .env.production.example azure-boards-mcp
```

Do not use `.env.production.example` unchanged in production. Replace placeholders through your deployment secret manager.

## Production Requirements

- Terminate TLS at an owned domain and route HTTPS traffic to `/mcp`.
- Keep `/healthz` available for readiness probes without exposing secrets.
- Configure Microsoft Entra OAuth with `AZURE_BOARDS_CLIENT_ID`, `AZURE_BOARDS_TENANT_ID`, and delegated Azure DevOps scopes.
- Store `AZURE_BOARDS_STORE_DIR` on encrypted persistent storage if snapshots, baselines, approval queues, audit trails, or decision packs must survive restarts.
- Do not require PAT entry for App Directory review. PAT and bearer-token modes are local development or controlled automation paths.
- Ensure reverse proxy, platform logs, and APM traces do not record request bodies, authorization headers, device codes, PATs, bearer tokens, or token-cache content.

## Deployment Checklist

1. Hosted URL returns healthy JSON from `/healthz`.
2. Hosted URL accepts JSON-RPC at `/mcp`.
3. `tools/list` includes product operating system tools.
4. OAuth status reports configured client without exposing secrets.
5. Approval apply workflows still require explicit preview, selection, confirmation, and result review.
6. Decision Pack exports are stored only in approved storage locations.

After deploying to the owned production domain, run:

```powershell
npm run smoke:hosted -- https://mcp.example.com/mcp
```

The smoke command also supports path-based deployments such as `https://mcp.example.com/azure-boards/mcp`; in that case it checks `https://mcp.example.com/azure-boards/healthz` and `https://mcp.example.com/azure-boards/mcp`.
