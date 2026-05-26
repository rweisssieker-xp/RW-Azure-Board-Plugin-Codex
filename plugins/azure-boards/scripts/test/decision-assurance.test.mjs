import test from "node:test";
import assert from "node:assert/strict";

const workItems = [
  {
    id: 801,
    type: "Requirement",
    title: "Customer support automation",
    state: "Active",
    assignedTo: "Business Owner",
    tags: ["customer"],
    description: "Customers need automated support status updates to reduce ticket volume and improve transparency.",
    acceptanceCriteria: "Given a ticket status changes, then the customer receives a status update and evidence is logged.",
    fields: { "Custom.BusinessValue": 9 }
  },
  {
    id: 802,
    type: "Requirement",
    title: "Weak political value claim",
    state: "Active",
    tags: [],
    description: "Nice to have.",
    fields: { "Custom.BusinessValue": 10, "Custom.CostOfDelay": 50000 }
  }
];

test("decision assurance tools produce audit-ready no-write outputs", async () => {
  const module = await import("../dist/decisionAssurance.js");
  const memory = module.decisionMemory(workItems, [{ workItemId: 801, decision: "continue", rationale: "customer value" }], [{ workItemId: 801, status: "confirmed", evidence: "ticket volume down" }]);
  const quality = module.recommendationQualityScore([{ workItemId: 801, action: "continue" }, { workItemId: 802, action: "defer" }], [{ workItemId: 801, status: "confirmed" }, { workItemId: 802, status: "reversed" }]);
  const inflation = module.valueInflationDetector(workItems);
  const court = module.decisionCourt(workItems, [{ workItemId: 802, action: "defer pending evidence" }]);

  assert.equal(memory.writePerformed, false);
  assert.equal(memory.memory[0].outcomeStatus, "confirmed");
  assert.ok(quality.scores.some((row) => row.status === "reversed"));
  assert.ok(inflation.inflation.some((row) => row.id === 802 && row.status !== "supported"));
  assert.ok(court.cases.some((row) => row.id === 802 && row.missingFacts.length > 0));
});

test("contract lifecycle, scenario war room, and autonomous governance agent are no-write previews", async () => {
  const module = await import("../dist/decisionAssurance.js");
  const contracts = module.requirementContractLifecycle(workItems);
  const scenarios = module.scenarioWarRoom(workItems, [{ name: "Budget minus 20 percent", budgetFactor: 0.8 }]);
  const agent = module.autonomousGovernanceAgent(workItems, [], { staleDays: 10 });

  assert.equal(contracts.writePerformed, false);
  assert.ok(contracts.contracts.every((row) => Array.isArray(row.patchPreview)));
  assert.equal(scenarios.writePerformed, false);
  assert.ok(scenarios.scenarios[0].atRisk.length >= 0);
  assert.equal(agent.writePerformed, false);
  assert.ok(agent.agenda.length > 0);
  assert.ok(agent.actionPreviews.every((row) => row.writePerformed === false));
});

test("analytics facade exports decision assurance tools", async () => {
  const analytics = await import("../dist/analytics.js");
  assert.equal(typeof analytics.decisionMemory, "function");
  assert.equal(typeof analytics.autonomousGovernanceAgent, "function");
  assert.equal(typeof analytics.scenarioWarRoom, "function");
});
