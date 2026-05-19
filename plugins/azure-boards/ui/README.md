# Azure Boards AI Cockpit UI

Static, local review UI for the Azure Boards plugin.

Open `index.html` directly in a browser. The page runs entirely in the browser:

- no backend server
- no Azure DevOps write calls
- no token handling
- no network calls from `app.js`

The UI supports sample data, pasted JSON, local JSON upload, report previews, Markdown preview, and local JSON/Markdown downloads. It is intended for reviewing plugin report payloads before invoking MCP tools such as bulk-close preview/apply workflows.

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
