import test from "node:test";
import assert from "node:assert/strict";

const workItems = [
  {
    id: 3101,
    fields: {
      "System.Id": 3101,
      "System.WorkItemType": "Requirement",
      "System.Title": "Automate invoice posting for finance closing",
      "System.State": "Closed",
      "System.AssignedTo": { displayName: "Finance Owner" },
      "System.Description": "Decision approved after QA verified invoice posting evidence for finance closing and audit traceability.",
      "Microsoft.VSTS.Common.AcceptanceCriteria": "Given approved invoices, then posting is validated with audit evidence.",
      "System.Tags": "finance;audit;validated",
      "System.ChangedDate": "2026-01-15T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 1,
      "Custom.TargetBenefit": 120000,
      "Custom.RealizedBenefit": 45000,
      "Custom.EstimatedCost": 30000
    },
    relations: [
      { rel: "AttachedFile", url: "https://example.invalid/evidence", attributes: { name: "qa-evidence.pdf" } }
    ]
  },
  {
    id: 3102,
    fields: {
      "System.Id": 3102,
      "System.WorkItemType": "Requirement",
      "System.Title": "Old warehouse report idea",
      "System.State": "Proposed",
      "System.Description": "Report should be nicer.",
      "System.ChangedDate": "2025-01-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 4,
      "Custom.BusinessValue": 1
    }
  },
  {
    id: 3103,
    fields: {
      "System.Id": 3103,
      "System.WorkItemType": "Feature",
      "System.Title": "GUDID regulatory integration backbone",
      "System.State": "Active",
      "System.AssignedTo": { displayName: "Regulatory Owner" },
      "System.Description": "Integration API for UDI GUDID regulatory submission with validated audit evidence and release traceability.",
      "Microsoft.VSTS.Common.AcceptanceCriteria": "Given approved master data, then the integration submits and logs regulatory evidence.",
      "System.Tags": "regulatory;integration",
      "System.ChangedDate": "2026-02-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 1,
      "Custom.TargetBenefit": 250000,
      "Microsoft.VSTS.Scheduling.Effort": 20
    }
  }
];

test("steering engine exports all enterprise USP functions", async () => {
  const steering = await import("../dist/steeringEngine.js");
  for (const name of [
    "outcomeRealizationCockpit",
    "aiBusinessCaseGenerator",
    "valueLeakageDetector",
    "decisionTraceabilityGraph",
    "erpProcessCriticalityModel",
    "automatedBoardDueDiligenceReport",
    "requirementInvestDivestMatrix",
    "changePortfolioSimulator",
    "aiSteeringCommitteePack",
    "policyAsCodeEvaluation"
  ]) {
    assert.equal(typeof steering[name], "function", `${name} should be exported`);
  }
});

test("outcome and business case reports expose benefit and ROI signals without writes", async () => {
  const { outcomeRealizationCockpit, aiBusinessCaseGenerator } = await import("../dist/steeringEngine.js");
  const outcome = outcomeRealizationCockpit(workItems);
  const business = aiBusinessCaseGenerator(workItems);
  assert.equal(outcome.writePerformed, false);
  assert.equal(business.writePerformed, false);
  assert.ok(Number(outcome.metrics.benefitGap) > 0);
  assert.ok(business.businessCases.some((entry) => entry.id === 3101 && Number(entry.roiPercent) > 0));
});

test("value leakage, invest divest matrix, and simulator classify economic actions", async () => {
  const { valueLeakageDetector, requirementInvestDivestMatrix, changePortfolioSimulator } = await import("../dist/steeringEngine.js");
  const leakage = valueLeakageDetector(workItems, { asOfDate: "2026-02-15T00:00:00.000Z", staleDays: 90 });
  const matrix = requirementInvestDivestMatrix(workItems, { defaultItemCost: 30000 });
  const simulation = changePortfolioSimulator(workItems, { closeIds: [3102] });
  assert.equal(leakage.writePerformed, false);
  assert.ok(leakage.leakage.some((entry) => entry.id === 3102));
  assert.ok(matrix.matrix.some((entry) => entry.quadrant === "divest" || entry.quadrant === "steering-decision"));
  assert.equal(simulation.simulation.removedIds[0], 3102);
});

test("traceability, criticality, due diligence, steering pack, and policy-as-code work together", async () => {
  const {
    decisionTraceabilityGraph,
    erpProcessCriticalityModel,
    automatedBoardDueDiligenceReport,
    aiSteeringCommitteePack,
    policyAsCodeEvaluation
  } = await import("../dist/steeringEngine.js");
  const graph = decisionTraceabilityGraph(workItems, [{ workItemId: 3101, text: "Approval decision accepted with QA evidence." }]);
  const criticality = erpProcessCriticalityModel(workItems);
  const diligence = automatedBoardDueDiligenceReport(workItems, [], { asOfDate: "2026-02-15T00:00:00.000Z" });
  const pack = aiSteeringCommitteePack(workItems, [diligence], { includeHtml: true });
  const policy = policyAsCodeEvaluation(workItems, { requiredTags: ["audit"], requiredFields: ["System.Description"] }, { asOfDate: "2026-02-15T00:00:00.000Z" });

  assert.equal(graph.writePerformed, false);
  assert.ok(graph.graph.nodes.length > workItems.length);
  assert.ok(criticality.criticality.some((entry) => entry.processArea === "Regulatory"));
  assert.equal(diligence.writePerformed, false);
  assert.match(pack.markdown, /AI Steering Committee Pack/);
  assert.match(pack.html, /html/);
  assert.ok(policy.controls.some((entry) => entry.status === "fail"));
});

test("analytics facade exports steering engine functions", async () => {
  const analytics = await import("../dist/analytics.js");
  assert.equal(typeof analytics.outcomeRealizationCockpit, "function");
  assert.equal(typeof analytics.aiSteeringCommitteePack, "function");
  assert.equal(typeof analytics.policyAsCodeEvaluation, "function");
});
