import test from "node:test";
import assert from "node:assert/strict";

const workItems = [
  {
    id: 2001,
    fields: {
      "System.Id": 2001,
      "System.WorkItemType": "Feature",
      "System.Title": "Invoice API automation for customer portal",
      "System.State": "Active",
      "System.Description": "Automate invoice export API for customer portal revenue protection and finance process reliability with measurable benefit tracking.",
      "System.Tags": "finance;integration;customer",
      "System.AreaPath": "ERP\\Finance",
      "System.CreatedDate": "2025-01-01T00:00:00.000Z",
      "System.ChangedDate": "2025-06-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 1,
      "Custom.BusinessValue": 8,
      "Custom.TargetBenefit": 120000,
      "Custom.JobDuration": 8
    }
  },
  {
    id: 2002,
    fields: {
      "System.Id": 2002,
      "System.WorkItemType": "Requirement",
      "System.Title": "Old optional dashboard color cleanup",
      "System.State": "Proposed",
      "System.Description": "Nice to have cosmetic cleanup.",
      "System.CreatedDate": "2024-01-01T00:00:00.000Z",
      "System.ChangedDate": "2024-01-15T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 4,
      "Custom.BusinessValue": 1
    }
  },
  {
    id: 2003,
    fields: {
      "System.Id": 2003,
      "System.WorkItemType": "Requirement",
      "System.Title": "Invoice API automation for customer portal",
      "System.State": "New",
      "System.Description": "Duplicate request for invoice API automation.",
      "System.ChangedDate": "2025-05-20T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 2,
      "Custom.BusinessValue": 6
    }
  },
  {
    id: 2004,
    fields: {
      "System.Id": 2004,
      "System.WorkItemType": "Feature",
      "System.Title": "De-scope production label redesign",
      "System.State": "Removed",
      "System.Description": "De-scope production label redesign after portfolio review.",
      "System.ChangedDate": "2025-04-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 3,
      "Custom.EstimatedCost": 45000
    }
  },
  {
    id: 2005,
    fields: {
      "System.Id": 2005,
      "System.WorkItemType": "Feature",
      "System.Title": "Completed UDI compliance submission",
      "System.State": "Closed",
      "System.Description": "UDI GUDID compliance submission automation for audit readiness.",
      "System.ChangedDate": "2025-02-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 1,
      "Custom.BusinessValue": 7,
      "Custom.TargetBenefit": 90000,
      "Custom.RealizedBenefit": 10000
    }
  }
];

test("portfolioEngine exports deterministic no-write analytics", async () => {
  const module = await import("../dist/portfolioEngine.js");
  for (const name of [
    "portfolioRationalization",
    "benefitRealizationTracking",
    "costAvoidanceByClosure",
    "costAvoidanceAnalysis",
    "erpDomainImpactScoring"
  ]) {
    assert.equal(typeof module[name], "function", `${name} should be exported`);
  }
});

test("portfolioRationalization classifies keep kill and merge decisions", async () => {
  const { portfolioRationalization } = await import("../dist/portfolioEngine.js");
  const report = portfolioRationalization(workItems, { asOfDate: "2025-06-15T00:00:00.000Z", staleDays: 120, lowValueThreshold: 35 });
  assertReportShape(report, "Portfolio Rationalization");
  assert.equal(report.generatedAt, "2025-06-15T00:00:00.000Z");
  assert.ok(report.findings.some((finding) => finding.id === 2001 && finding.signals.includes("decision merge")));
  assert.ok(report.findings.some((finding) => finding.id === 2002 && finding.signals.includes("decision kill")));
  assert.ok(Number(report.metrics.merge) >= 1);
});

test("benefitRealizationTracking flags benefit gaps after completion lag", async () => {
  const { benefitRealizationTracking } = await import("../dist/portfolioEngine.js");
  const report = benefitRealizationTracking(workItems, { asOfDate: "2025-06-15T00:00:00.000Z", realizationLagDays: 30 });
  assertReportShape(report, "Benefit Realization Tracking");
  const completed = report.findings.find((finding) => finding.id === 2005);
  assert.ok(completed, "closed item with target benefit should be tracked");
  assert.ok(completed.signals.some((signal) => signal.includes("realization rate")));
  assert.ok(Number(report.metrics.targetBenefit) >= 90000);
});

test("costAvoidanceByClosure estimates explicit de-scope savings", async () => {
  const { costAvoidanceByClosure, costAvoidanceAnalysis } = await import("../dist/portfolioEngine.js");
  const report = costAvoidanceByClosure(workItems, { asOfDate: "2025-06-15T00:00:00.000Z" });
  assertReportShape(report, "Cost Avoidance by Closing or De-scoping");
  assert.ok(report.findings.some((finding) => finding.id === 2004 && finding.signals.includes("avoided cost 45000")));
  assert.equal(costAvoidanceAnalysis, costAvoidanceByClosure);
});

test("erpDomainImpactScoring ranks ERP domain matches", async () => {
  const { erpDomainImpactScoring } = await import("../dist/portfolioEngine.js");
  const report = erpDomainImpactScoring(workItems, { asOfDate: "2025-06-15T00:00:00.000Z" });
  assertReportShape(report, "ERP Domain Impact Scoring");
  assert.ok(report.findings.some((finding) => finding.id === 2001 && finding.signals.includes("primary domain Finance")));
  assert.ok(Number(report.metrics.Finance) >= 1);
});

function assertReportShape(report, title) {
  assert.equal(report.title, title);
  assert.equal(typeof report.generatedAt, "string");
  assert.equal(typeof report.summary, "string");
  assert.ok(Array.isArray(report.findings));
  assert.equal(typeof report.metrics, "object");
  assert.ok(Array.isArray(report.nextActions));
}
