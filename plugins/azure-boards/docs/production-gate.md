# Production Gate

Run the production gate from `plugins/azure-boards/scripts`:

```powershell
npm run check:production
```

The gate intentionally fails while publisher-owned production values are still placeholders. Passing requires:

- `.codex-plugin/plugin.json` uses real support, website, repository, privacy policy, and terms URLs.
- Screenshot assets exist and are referenced by the manifest.
- Hosted MCP source, Dockerfile, deployment docs, and env template exist.
- Product operating system functions are implemented.
- Decision Packs include Steering Pack, Audit Pack, Handover Pack, and Operating Rhythm.
- Reminder plans include schedule metadata.
- `docs/release-handoff-checklist.md` covers publisher metadata, hosted MCP, OAuth, product evidence, and final gates.

Prepare the publisher-owned values by copying `production-publisher-inputs.example.json` to `production-publisher-inputs.json`, replacing every placeholder with the real production value, and applying it from `plugins/azure-boards/scripts`:

```powershell
npm run apply:production-inputs -- ..\production-publisher-inputs.json
npm run check:production
```

Use JSON output for release automation:

```powershell
node production-readiness-check.mjs --json
```

Do not bypass failed publisher-owned URL checks for App Directory or Azure DevOps Marketplace review. Those values must come from the actual publisher and deployment environment.
