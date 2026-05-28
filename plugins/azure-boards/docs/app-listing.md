# Azure Board Plugin Codex App Listing Draft

## Display Name

Azure Board Plugin Codex

## Subtitle

Governance, approval, and delivery cockpit for Azure Boards.

## Short Description

Review Azure Boards work, detect delivery and governance risk, prepare approval queues, preserve decision memory, and export steering or handover packs with evidence.

## Long Description

Azure Board Plugin Codex turns Azure Boards work item data into an operational decision cockpit for product, delivery, portfolio, and compliance teams. It supports read-only board analysis, role-specific views, persistent snapshots and baselines, approval queues, audit trails, policy checks, benefit follow-ups, decision pack exports, outcome proof, decision memory learning, Board-to-Value mapping, autonomous governance planning, compliance evidence scoring, scope creep detection, approval simulation, executive steering rooms, decision knowledge graphs, and AI readiness governance.

Write-capable workflows use explicit preview and apply steps. Users can inspect proposed field changes, comments, state transitions, approval selections, secondary-approval needs, and verification steps before any Azure DevOps write occurs. After apply, result review compares apply results with current Work Items and produces audit events.

## Screenshots To Capture

Included screenshot:

- `assets/screenshots/decision-pack.png`: sanitized static cockpit screenshot showing Decision Pack export.
- `assets/screenshots/approval-workflow.png`: sanitized static cockpit screenshot showing approval selection, apply plan, and result review.

Additional screenshots to capture before marketplace submission:

1. Persistent Snapshot: board metrics, stale work, evidence count, and fingerprint.
2. Approval Queue: pending recommendation rows with risk, selected state, and verification steps.
3. Decision Audit Trail: accepted, rejected, overridden, and recorded events.
4. Role Cockpits: Product Owner, Scrum Master, CIO, and Compliance views.
5. Decision Pack Export: Steering Pack, Audit Trail, Handover Pack, Operating Rhythm Markdown, and import/export manifest.
6. Executive Steering Room: outcome proof, Board-to-Value map, approval simulation, and decision knowledge graph.

Use `demo/erp-board-demo.json` or sanitized tenant data only.

## Review Notes

- The local static UI is no-write and browser-only.
- Hosted production use requires an HTTPS MCP endpoint and production Microsoft Entra OAuth configuration.
- PAT and bearer-token modes are local development or controlled automation options, not the preferred App Directory review path.
- Generated reports are decision support. Authoritative changes require explicit preview/apply tools and user confirmation.
