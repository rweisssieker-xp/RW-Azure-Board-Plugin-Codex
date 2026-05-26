import test from "node:test";
import assert from "node:assert/strict";

const workItems = [
  {
    id: 4101,
    fields: {
      "System.Id": 4101,
      "System.WorkItemType": "Requirement",
      "System.Title": "Cutover critical GUDID integration",
      "System.State": "Active",
      "System.AssignedTo": { displayName: "Regulatory Owner" },
      "System.Description": "Integration for UDI GUDID regulatory cutover. Decision exception may be needed if supplier data is delayed.",
      "Microsoft.VSTS.Common.AcceptanceCriteria": "Given approved master data, then submission evidence is validated and attached.",
      "System.Tags": "regulatory;integration;evidence",
      "System.AreaPath": "ERP\\Regulatory",
      "System.ChangedDate": "2026-02-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 1,
      "Custom.TargetBenefit": 220000,
      "Custom.EstimatedCost": 65000
    },
    relations: [{ rel: "AttachedFile", attributes: { name: "validation-evidence.pdf" } }]
  },
  {
    id: 4102,
    fields: {
      "System.Id": 4102,
      "System.WorkItemType": "Requirement",
      "System.Title": "Old optional warehouse label idea",
      "System.State": "Proposed",
      "System.Description": "Make label nicer.",
      "System.ChangedDate": "2025-01-01T00:00:00.000Z",
      "Microsoft.VSTS.Common.Priority": 4,
      "Custom.BusinessValue": 1
    }
  },
  {
    id: 4103,
    fields: {
      "System.Id": 4103,
      "System.WorkItemType": "Feature",
      "System.Title": "Completed invoice automation",
      "System.State": "Closed",
      "System.AssignedTo": { displayName: "Finance Owner" },
      "System.Description": "Decision approved after QA evidence for invoice automation.",
      "Microsoft.VSTS.Common.AcceptanceCriteria": "Posting and audit evidence verified.",
      "System.Tags": "finance;audit;approved",
      "System.ChangedDate": "2026-01-01T00:00:00.000Z",
      "Custom.TargetBenefit": 90000,
      "Custom.RealizedBenefit": 0
    }
  }
];

const evidence = [
  { workItemId: 4101, text: "Exception waiver requested for supplier dependency blocker.", actor: "Regulatory Owner" },
  { workItemId: 4103, text: "Approval decision accepted with QA evidence.", actor: "Finance Owner" }
];

test("governance operating system exports all USP functions", async () => {
  const module = await import("../dist/governanceOperatingSystem.js");
  for (const name of [
    "autonomousBoardAuditor",
    "requirementRewriteStudio",
    "decisionMeetingCopilot",
    "cleanupCampaignManager",
    "financialBacklogLedger",
    "requirementConfidenceScore",
    "dependencyBlockerGraph",
    "processOwnerControlTower",
    "migrationCutoverReadiness",
    "aiExceptionRegister",
    "benefitRealizationFollowup",
    "operatingRhythmPlanner",
    "okrAlignmentScorer",
    "complianceReadinessReview",
    "handoverPackGenerator",
    "portfolioFitnessIndex"
  ]) {
    assert.equal(typeof module[name], "function", `${name} should be exported`);
  }
});

test("audit, rewrite, meeting, and cleanup tools produce no-write previews", async () => {
  const { autonomousBoardAuditor, requirementRewriteStudio, decisionMeetingCopilot, cleanupCampaignManager } = await import("../dist/governanceOperatingSystem.js");
  const audit = autonomousBoardAuditor(workItems, { staleDays: 30 });
  const rewrite = requirementRewriteStudio(workItems);
  const meeting = decisionMeetingCopilot(workItems, evidence);
  const campaign = cleanupCampaignManager(workItems, { target: "missing-description" });
  assert.equal(audit.writePerformed, false);
  assert.ok(audit.auditRows.some((row) => row.status === "fail"));
  assert.ok(rewrite.rewrites.some((row) => Array.isArray(row.patchPreview)));
  assert.match(meeting.minutesDraft, /Decision Meeting Draft/);
  assert.equal(campaign.campaign.approvalRequired, true);
});

test("financial, confidence, dependency, control tower, cutover, exception, and follow-up reports work", async () => {
  const {
    financialBacklogLedger,
    requirementConfidenceScore,
    dependencyBlockerGraph,
    processOwnerControlTower,
    migrationCutoverReadiness,
    aiExceptionRegister,
    benefitRealizationFollowup
  } = await import("../dist/governanceOperatingSystem.js");
  const ledger = financialBacklogLedger(workItems);
  const confidence = requirementConfidenceScore(workItems);
  const graph = dependencyBlockerGraph(workItems, evidence);
  const tower = processOwnerControlTower(workItems);
  const cutover = migrationCutoverReadiness(workItems);
  const exceptions = aiExceptionRegister(workItems, evidence);
  const followup = benefitRealizationFollowup(workItems, { realizationLagDays: 1 });
  assert.ok(ledger.ledger.some((row) => row.id === 4101 && Number(row.expectedBenefit) > 0));
  assert.ok(confidence.scores.some((row) => row.status === "not investable"));
  assert.ok(graph.graph.edges.length > 0);
  assert.ok(tower.teams.length > 0);
  assert.match(String(cutover.readiness.goNoGo), /go|conditional-go|no-go/);
  assert.ok(exceptions.exceptions.some((row) => row.id === 4101));
  assert.ok(followup.followups.some((row) => row.id === 4103));
});

test("operating rhythm, alignment, compliance, handover, and fitness tools produce no-write governance outputs", async () => {
  const {
    operatingRhythmPlanner,
    okrAlignmentScorer,
    complianceReadinessReview,
    handoverPackGenerator,
    portfolioFitnessIndex
  } = await import("../dist/governanceOperatingSystem.js");
  const rhythm = operatingRhythmPlanner(workItems, { staleDays: 30 });
  const alignment = okrAlignmentScorer(workItems, { objectives: ["regulatory compliance", "finance automation"] });
  const compliance = complianceReadinessReview(workItems);
  const handover = handoverPackGenerator(workItems, evidence, { role: "Project Lead" });
  const fitness = portfolioFitnessIndex(workItems, { staleDays: 30 });
  assert.equal(rhythm.writePerformed, false);
  assert.ok(rhythm.cadence.some((row) => row.cadence === "daily"));
  assert.ok(alignment.alignments.some((row) => row.id === 4102 && row.status === "unaligned"));
  assert.ok(compliance.controls.some((row) => row.control === "exception"));
  assert.match(handover.markdown, /Project Lead Handover Pack/);
  assert.match(String(fitness.fitness.status), /healthy|strained|critical/);
});

test("analytics facade exports governance operating system functions", async () => {
  const analytics = await import("../dist/analytics.js");
  assert.equal(typeof analytics.migrationCutoverReadiness, "function");
  assert.equal(typeof analytics.financialBacklogLedger, "function");
  assert.equal(typeof analytics.requirementRewriteStudio, "function");
  assert.equal(typeof analytics.operatingRhythmPlanner, "function");
  assert.equal(typeof analytics.portfolioFitnessIndex, "function");
});
