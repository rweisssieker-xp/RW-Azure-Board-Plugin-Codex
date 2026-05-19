import test from "node:test";
import assert from "node:assert/strict";

const workItems = [
  {
    id: 2101,
    fields: {
      "System.Id": 2101,
      "System.WorkItemType": "Requirement",
      "System.Title": "Automated UDI evidence export to GUDID",
      "System.State": "Active",
      "System.AssignedTo": { displayName: "Product Owner" },
      "System.Tags": "compliance;integration",
      "System.Description": "Automated regulatory export for UDI and GUDID compliance. The requirement reduces audit exposure, removes manual re-entry, and creates traceable evidence for decision review.",
      "Microsoft.VSTS.Common.AcceptanceCriteria": "Given approved product master data, when the export job runs, then validated GUDID evidence is produced with an audit log and rejected records are visible to the owner.",
      "System.ChangedDate": "2026-04-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 1
    },
    relations: [
      { rel: "AttachedFile", url: "https://example.invalid/file", attributes: { name: "regulatory-evidence.pdf" } }
    ]
  },
  {
    id: 2102,
    fields: {
      "System.Id": 2102,
      "System.WorkItemType": "Requirement",
      "System.Title": "Old unclear portal request",
      "System.State": "Proposed",
      "System.Description": "Portal should be better.",
      "System.ChangedDate": "2025-01-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 4
    }
  }
];

test("decision engine exports no-write analytics functions", async () => {
  const decisionEngine = await import("../dist/decisionEngine.js");
  for (const name of [
    "requirementDecisionCockpit",
    "evidenceFirstRequirementReview",
    "cioRequirementRiskView"
  ]) {
    assert.equal(typeof decisionEngine[name], "function", `${name} should be exported`);
  }
});

test("analytics public facade exports decision, portfolio, and evidence ledger functions", async () => {
  const analytics = await import("../dist/analytics.js");
  for (const name of [
    "requirementDecisionCockpit",
    "evidenceFirstRequirementReview",
    "cioRequirementRiskView",
    "portfolioRationalization",
    "benefitRealizationTracking",
    "costAvoidanceByClosure",
    "costAvoidanceAnalysis",
    "erpDomainImpactScoring",
    "closureGovernanceLedger",
    "auditDecisionLog",
    "boardHygieneAutomationPreview",
    "evidencePackCompleteness"
  ]) {
    assert.equal(typeof analytics[name], "function", `${name} should be exported from analytics facade`);
  }
});

test("requirementDecisionCockpit scores requirements without write intent", async () => {
  const { requirementDecisionCockpit } = await import("../dist/decisionEngine.js");
  const report = requirementDecisionCockpit(workItems);
  assert.equal(report.title, "Requirement Decision Cockpit");
  assert.equal(report.writePerformed, false);
  assert.equal(report.decisions[0].id, 2101);
  assert.equal(report.decisions.some((decision) => decision.id === 2102 && decision.decision === "park"), true);
});

test("evidenceFirstRequirementReview flags weak requirement evidence", async () => {
  const { evidenceFirstRequirementReview } = await import("../dist/decisionEngine.js");
  const report = evidenceFirstRequirementReview(workItems);
  const weakReview = report.reviews.find((review) => review.id === 2102);
  assert.equal(report.writePerformed, false);
  assert.ok(weakReview);
  assert.ok(weakReview.missingEvidence.includes("acceptance criteria"));
  assert.ok(report.findings.some((finding) => finding.id === 2102));
});

test("cioRequirementRiskView highlights stale unowned regulated requirements", async () => {
  const { cioRequirementRiskView } = await import("../dist/decisionEngine.js");
  const report = cioRequirementRiskView(workItems, { staleDays: 30 });
  const risk = report.riskItems.find((item) => item.id === 2102);
  assert.equal(report.writePerformed, false);
  assert.ok(risk);
  assert.ok(risk.exposure.includes("no assigned owner"));
  assert.ok(report.metrics.high >= 1 || report.metrics.medium >= 1);
});
