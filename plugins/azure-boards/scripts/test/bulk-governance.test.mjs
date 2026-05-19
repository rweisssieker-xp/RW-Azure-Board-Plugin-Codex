import test from "node:test";
import assert from "node:assert/strict";

const workItems = [
  {
    id: 1001,
    fields: {
      "System.Id": 1001,
      "System.WorkItemType": "Requirement",
      "System.Title": "UDI data transfer to GUDID",
      "System.State": "Proposed",
      "System.Description": "Automated UDI data transfer to GUDID for regulatory compliance and risk reduction.",
      "System.ChangedDate": "2025-01-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 2,
      "Custom.BusinessValue": 1,
      "Custom.TimeCriticality": 1,
      "Custom.RiskReduction": 1,
      "Custom.CostOfDelay": 3,
      "Custom.JobDuration": 1
    },
    relations: [
      { rel: "AttachedFile", url: "https://example.invalid/file", attributes: { name: "evidence.docx" } }
    ]
  },
  {
    id: 1002,
    fields: {
      "System.Id": 1002,
      "System.WorkItemType": "Task",
      "System.Title": "Implement UDI job",
      "System.State": "Active",
      "System.ChangedDate": "2025-01-02T00:00:00.000Z"
    },
    relations: [
      { rel: "System.LinkTypes.Hierarchy-Reverse", url: "https://dev.azure.com/org/_apis/wit/workItems/1001", attributes: { name: "Parent" } }
    ]
  }
];

test("bulk governance analytics exports are available", async () => {
  const analytics = await import("../dist/analytics.js");
  for (const name of [
    "closeCandidates",
    "wsjfConsistencyCheck",
    "businessValueEstimate",
    "attachmentEvidenceSummary",
    "parentChildCleanup",
    "bulkClosePreview"
  ]) {
    assert.equal(typeof analytics[name], "function", `${name} should be exported`);
  }
});

test("wsjfConsistencyCheck flags low WSJF for compliance evidence", async () => {
  const { wsjfConsistencyCheck } = await import("../dist/analytics.js");
  const report = wsjfConsistencyCheck([workItems[0]]);
  assert.equal(report.title, "WSJF Consistency Check");
  assert.ok(report.findings.some((finding) => finding.id === 1001));
});

test("businessValueEstimate returns euro ranges without writing", async () => {
  const { businessValueEstimate } = await import("../dist/analytics.js");
  const report = businessValueEstimate([workItems[0]]);
  assert.equal(report.writePerformed, undefined);
  assert.ok(report.estimates[0].estimatedAnnualBenefitHigh >= report.estimates[0].estimatedAnnualBenefitLow);
});

test("bulkClosePreview includes child impact and requires approval", async () => {
  const { bulkClosePreview } = await import("../dist/analytics.js");
  const preview = bulkClosePreview(workItems, { reason: "cleanup after portfolio review" });
  assert.equal(preview.writePerformed, false);
  assert.equal(preview.approvalRequired, true);
  assert.equal(preview.targets.length, 2);
  assert.ok(preview.targets.some((target) => target.id === 1001 && target.childImpact.some((child) => child.id === 1002)));
});
