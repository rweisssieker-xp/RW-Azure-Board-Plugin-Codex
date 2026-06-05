# Production Gate

Run the marketplace runtime gate from `scripts`:

```powershell
npm run check:dist
```

The gate intentionally fails while production deployment values are still placeholders. Passing requires:

- `.codex-plugin/plugin.json` uses real support, website, repository, privacy policy, and terms URLs.
- `chatgpt-app-submission.json` uses real support, website, privacy policy, terms, hosted MCP, and Microsoft Entra values.
- Screenshot assets exist and are referenced by the manifest.
- Hosted MCP source, Dockerfile, deployment docs, and env template exist.
- Product operating system functions are implemented.
- Decision Packs include Steering Pack, Audit Pack, Handover Pack, and Operating Rhythm.
- Reminder plans include schedule metadata.
- `docs/release-handoff-checklist.md` covers publisher metadata, hosted MCP, OAuth, product evidence, and final gates.

Prepare deployment values by copying `production-publisher-inputs.example.json` to `production-publisher-inputs.json`, replacing every placeholder with the real production value, and applying it in your hosted deployment process:

```powershell
npm run check:dist
```

Use JSON output for release automation:

```powershell
node production-readiness-check.mjs --json
```

Do not bypass failed hosted MCP or Microsoft Entra checks for App Directory or Azure DevOps Marketplace review. Those values must come from the actual deployment environment.
