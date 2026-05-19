import test from "node:test";
import assert from "node:assert/strict";

const workItems = [
  {
    id: 2001,
    fields: {
      "System.Id": 2001,
      "System.WorkItemType": "Requirement",
      "System.Title": "Validated invoice approval workflow",
      "System.State": "Closed",
      "System.AssignedTo": { displayName: "Ada Auditor" },
      "System.Description": "Decision: approved after QA verified invoice posting evidence and release notes.",
      "Microsoft.VSTS.Common.AcceptanceCriteria": "Given invoice approval, then posting and audit trail are verified.",
      "System.Tags": "Audit; Approved",
      "System.ChangedDate": "2026-01-20T00:00:00.000Z"
    },
    relations: [
      { rel: "AttachedFile", url: "https://example.invalid/evidence", attributes: { name: "qa-evidence.pdf" } },
      { rel: "ArtifactLink", url: "vstfs:///Git/PullRequestId/1", attributes: { name: "Pull Request" } }
    ]
  },
  {
    id: 2002,
    fields: {
      "System.Id": 2002,
      "System.WorkItemType": "Bug",
      "System.Title": "Stale payment export defect",
      "System.State": "Active",
      "System.Description": "Payment export mismatch needs investigation.",
      "System.ChangedDate": "2025-01-01T00:00:00.000Z"
    }
  },
  {
    id: 2003,
    fields: {
      "System.Id": 2003,
      "System.WorkItemType": "Task",
      "System.Title": "Child task left open",
      "System.State": "Active",
      "System.ChangedDate": "2026-01-25T00:00:00.000Z"
    },
    relations: [
      { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://dev.azure.com/org/_apis/wit/workItems/2001", attributes: { name: "Parent" } }
    ]
  }
];

const evidence = [
  {
    workItemId: 2001,
    type: "comment",
    text: "Approval decision: release accepted because QA evidence and build log were reviewed.",
    createdBy: { displayName: "Quinn Reviewer" },
    createdDate: "2026-01-19T08:00:00.000Z"
  },
  {
    workItemId: 2001,
    type: "update",
    revisedFields: { "System.State": "Closed" },
    revisedBy: { displayName: "Ada Auditor" },
    revisedDate: "2026-01-20T09:00:00.000Z"
  }
];

test("evidence ledger module exports no-write analytics functions", async () => {
  const ledger = await import("../dist/evidenceLedger.js");
  for (const name of [
    "closureGovernanceLedger",
    "auditDecisionLog",
    "boardHygieneAutomationPreview",
    "evidencePackCompleteness"
  ]) {
    assert.equal(typeof ledger[name], "function", `${name} should be exported`);
  }
});

test("closureGovernanceLedger creates terminal item ledger entries", async () => {
  const { closureGovernanceLedger } = await import("../dist/evidenceLedger.js");
  const report = closureGovernanceLedger(workItems, evidence, { asOf: "2026-02-01T00:00:00.000Z" });

  assert.equal(report.title, "Closure Governance Ledger");
  assert.equal(report.writePerformed, false);
  assert.equal(report.ledger.length, 1);
  assert.equal(report.ledger[0].id, 2001);
  assert.equal(report.ledger[0].governanceStatus, "complete");
  assert.ok(report.ledger[0].evidenceSignals.length >= 3);
});

test("auditDecisionLog extracts decisions from fields and supplied comments", async () => {
  const { auditDecisionLog } = await import("../dist/evidenceLedger.js");
  const report = auditDecisionLog(workItems, evidence, { asOf: "2026-02-01T00:00:00.000Z" });

  assert.equal(report.writePerformed, false);
  assert.ok(report.decisions.some((decision) => decision.id === 2001 && decision.source === "comment"));
  assert.ok(report.decisions.some((decision) => decision.id === 2001 && decision.source === "state"));
});

test("boardHygieneAutomationPreview proposes deterministic actions without writes", async () => {
  const { boardHygieneAutomationPreview } = await import("../dist/evidenceLedger.js");
  const report = boardHygieneAutomationPreview(workItems, { asOf: "2026-02-01T00:00:00.000Z", staleDays: 30 });

  assert.equal(report.writePerformed, false);
  assert.equal(report.approvalRequired, true);
  assert.ok(report.actions.some((action) => action.id === 2002 && action.actionType === "request-owner"));
  assert.ok(report.actions.some((action) => action.id === 2002 && action.actionType === "refresh-stale-item"));
  assert.ok(report.actions.some((action) => action.id === 2003 && action.actionType === "review-terminal-child"));
});

test("evidencePackCompleteness scores missing evidence categories", async () => {
  const { evidencePackCompleteness } = await import("../dist/evidenceLedger.js");
  const report = evidencePackCompleteness(workItems, evidence, { asOf: "2026-02-01T00:00:00.000Z" });

  assert.equal(report.writePerformed, false);
  assert.equal(report.packs.find((pack) => pack.id === 2001)?.completeness, 100);
  assert.ok((report.packs.find((pack) => pack.id === 2002)?.completeness ?? 100) < 100);
  assert.ok(report.findings.some((finding) => finding.id === 2002));
});
