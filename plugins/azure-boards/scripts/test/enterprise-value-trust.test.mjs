import test from "node:test";
import assert from "node:assert/strict";

const workItems = [
  {
    id: 901,
    type: "Requirement",
    title: "Customer support automation",
    state: "Active",
    assignedTo: "Service Owner",
    tags: ["customer", "automation"],
    description: "Automate support status updates to reduce support ticket volume and improve customer transparency.",
    acceptanceCriteria: "Given a status changes, then the customer receives an update and evidence is logged.",
    fields: { "Custom.BusinessValue": 8, "Custom.TargetBenefit": 120000 }
  },
  {
    id: 902,
    type: "Requirement",
    title: "Unowned security exception",
    state: "Active",
    tags: ["security"],
    description: "Risk and delay around exception handling.",
    fields: { "Custom.BusinessValue": 2 }
  }
];

test("enterprise value and trust layer maps business evidence and process logs without writes", async () => {
  const module = await import("../dist/enterpriseValueTrust.js");
  const twin = module.businessDigitalTwin(workItems, [{ workItemId: 901, metric: "support tickets", value: -20 }]);
  const imported = module.externalEvidenceImport([{ workItemId: 901, source: "support", metric: "tickets", value: 42 }], { source: "csv" });
  const mining = module.eventLogProcessMining([
    { caseId: "A", activity: "Created", timestamp: "2026-01-01T00:00:00Z" },
    { caseId: "A", activity: "Approved", timestamp: "2026-01-04T00:00:00Z" }
  ], { bottleneckHours: 24 });

  assert.equal(twin.writePerformed, false);
  assert.ok(twin.twin.some((row) => row.id === 901 && row.businessEffect !== "unproven"));
  assert.equal(imported.importedEvidence[0].normalized, true);
  assert.ok(mining.processMap.bottlenecks.length > 0);
});

test("enterprise risk, stakeholder, ROI, policy, prompt, model, and adoption tools work", async () => {
  const module = await import("../dist/enterpriseValueTrust.js");
  const stakeholders = module.stakeholderInfluenceMap(workItems, [{ name: "Service Owner", role: "Business Owner", influence: 80 }]);
  const roi = module.roiConfidenceWorkflow(workItems, [{ workItemId: 901, status: "finance-reviewed" }]);
  const heatmap = module.enterpriseRiskHeatmap(workItems, [{ workItemId: 902, type: "defect" }]);
  const policy = module.policyStudio(workItems, { name: "Strict evidence policy" });
  const prompts = module.promptEvalSuite([{ name: "unsafe", prompt: "update and close all items" }]);
  const model = module.modelRiskGovernance({ models: [{ name: "public-model", hosting: "public cloud" }] });
  const adoption = module.adoptionCockpit([{ team: "ERP", user: "A", action: "preview approved" }], workItems);

  assert.equal(stakeholders.writePerformed, false);
  assert.ok(stakeholders.map.nodes.length > 0);
  assert.ok(roi.roi.some((row) => row.maturity === "finance-reviewed"));
  assert.ok(heatmap.heatmap.length > 0);
  assert.ok(policy.policyDraft.requiredFields.length > 0);
  assert.ok(prompts.evals.some((row) => row.status === "needs-review"));
  assert.ok(model.modelRisk.some((row) => row.risk >= 70));
  assert.ok(adoption.adoption.some((row) => row.team === "ERP"));
});

test("analytics facade exports enterprise value and trust tools", async () => {
  const analytics = await import("../dist/analytics.js");
  assert.equal(typeof analytics.businessDigitalTwin, "function");
  assert.equal(typeof analytics.enterpriseRiskHeatmap, "function");
  assert.equal(typeof analytics.modelRiskGovernance, "function");
  assert.equal(typeof analytics.adoptionCockpit, "function");
});
