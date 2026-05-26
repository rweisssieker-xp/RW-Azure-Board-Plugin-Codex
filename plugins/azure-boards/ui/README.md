# Azure Boards Review Cockpit UI

Static, local review UI for the Azure Boards plugin.

Open `index.html` directly in a browser. The page runs entirely in the browser:

- no backend server
- no Azure DevOps write calls
- no token handling
- no network calls from `app.js`

The UI supports sample data, pasted JSON, local JSON upload, report previews, Markdown preview, and local JSON/Markdown downloads. It is intended for reviewing plugin report payloads before invoking MCP tools such as bulk-close preview/apply workflows.

Included report previews cover delivery risk, requirement decision support, portfolio rationalization, evidence ledgers, steering packs, bulk-close previews, migration cutover readiness, financial backlog ledgers, requirement confidence scoring, requirement rewrite previews, exception registers, operating rhythm planning, OKR alignment, compliance readiness, handover packs, portfolio fitness, persistent snapshots, approval queues with local selection/apply-plan/result-review controls, audit trails, role cockpits, production admin controls, reminder plans with schedule metadata, and Decision Pack import/export manifests with steering, audit, handover, and operating rhythm sections.

For screenshot and demo preparation, load `../demo/erp-board-demo.json`. It contains sanitized ERP, finance, customer portal, migration, evidence, and cutover examples.

Expected JSON shape:

```json
{
  "items": [
    {
      "id": 1234,
      "type": "Requirement",
      "title": "Example requirement",
      "state": "Active",
      "priority": 2
    }
  ],
  "evidence": []
}
```
