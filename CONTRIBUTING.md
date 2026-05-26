# Contributing

Thank you for contributing to Azure Board Plugin Codex.

## Development Setup

```powershell
cd plugins\azure-boards\scripts
npm install
npm test
```

## Pull Request Expectations

- Keep changes focused and tied to a clear issue or improvement.
- Add or update tests for behavior changes.
- Update documentation when user-visible behavior, setup, deployment, or security guidance changes.
- Do not commit secrets, `.env` files, token caches, customer data, private board exports, or private `production-publisher-inputs.json` files.
- Keep write-capable Azure Boards workflows behind explicit preview and approval.

## Verification

Run these checks before opening a pull request:

```powershell
cd plugins\azure-boards\scripts
npm test
npm run check:production
```

`npm run check:production` is expected to fail until real hosted MCP and Microsoft Entra deployment values are configured. Product, documentation, and safety checks should still pass.

## Coding Style

- Prefer deterministic, no-write analysis for advisory tools.
- Use explicit result fields for write intent, approval state, assumptions, evidence, and audit output.
- Do not expose tokens, PATs, bearer values, device codes, or token-cache paths.
- Keep documentation in US English.
