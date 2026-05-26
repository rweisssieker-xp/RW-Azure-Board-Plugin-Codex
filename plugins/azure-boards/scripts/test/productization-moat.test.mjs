import test from "node:test";
import assert from "node:assert/strict";

const workItems = [
  {
    id: 1201,
    type: "Requirement",
    title: "Finance close automation",
    state: "Active",
    assignedTo: "Finance Owner",
    tags: ["Finance", "Automation"],
    description: "Automate finance close evidence to reduce manual cost, audit risk, and cycle time for the monthly close process.",
    acceptanceCriteria: "Given close evidence is complete, then the owner can approve the result and trace exceptions.",
    fields: { "Custom.BusinessValue": 9, "Custom.TargetBenefit": 140000 },
    changedDate: "2026-01-01T00:00:00Z"
  },
  {
    id: 1202,
    type: "Requirement",
    title: "Unowned visual preference",
    state: "New",
    tags: ["UI"],
    description: "Small change.",
    fields: { "Custom.BusinessValue": 8 },
    changedDate: "2025-12-01T00:00:00Z"
  }
];

test("productization moat tools assess enterprise rollout without writes", async () => {
  const module = await import("../dist/productizationMoat.js");

  const connectors = module.connectorReadinessAudit([{ name: "Azure Boards", configured: true, scopes: ["vso.work"], owner: "Admin", healthCheck: true }]);
  const evidence = module.evidenceIngestionPipeline([{ workItemId: 1201, name: "finance.csv", text: "Cost saving evidence with owner approval" }]);
  const security = module.securityPrivacyReview({ tenantIsolation: true, rbac: false }, [{ name: "attachments", classification: "confidential", token: "redacted-in-test" }]);
  const marketplace = module.marketplaceSubmissionReadiness({ privacyUrl: "https://example.test/privacy", tools: { sample: {} } });
  const rollout = module.orgRolloutReadiness({ executiveSponsor: "CIO", adminConsent: true }, [{ name: "ERP", users: 5, owner: "Lead" }]);

  assert.equal(connectors.writePerformed, false);
  assert.ok(connectors.readiness.some((row) => row.connector === "Azure Boards" && row.status === "ready"));
  assert.equal(evidence.pipeline[0].retainContent, false);
  assert.ok(security.controls.some((row) => row.status === "missing" || row.status === "needs-review"));
  assert.ok(marketplace.checklist.some((row) => row.status === "missing"));
  assert.ok(rollout.rollout.length > 0);
});

test("commercial, data-moat, follow-up, and adoption experiment tools produce structured plans", async () => {
  const module = await import("../dist/productizationMoat.js");

  const license = module.licensePackagingAdvisor([{ team: "ERP", user: "A", action: "approval apply" }, { team: "ERP", user: "B", action: "policy audit" }], { requiresCompliance: true });
  const valueCase = module.customerValueCaseBuilder(workItems, [{ workItemId: 1201, value: 25000 }]);
  const catalog = module.proprietarySignalCatalog(workItems, [{ workItemId: 1201, label: "correct-close" }], [{ workItemId: 1201, status: "closure approved" }]);
  const followup = module.autonomousFollowupScheduler(workItems, { cadenceDays: 7 });
  const experiments = module.adoptionExperimentDesigner([{ team: "ERP", user: "A" }], [{ name: "ERP" }], { durationDays: 21 });

  assert.equal(license.writePerformed, false);
  assert.ok(license.packages.some((row) => row.edition === "Enterprise"));
  assert.ok(valueCase.valueCases.some((row) => row.estimatedAnnualValue >= 140000));
  assert.ok(catalog.signals.some((row) => row.name === "feedback-labels"));
  assert.ok(followup.followups.some((row) => row.writePerformed === false));
  assert.ok(experiments.experiments.some((row) => row.team === "ERP" && row.durationDays === 21));
});

test("analytics facade exports productization moat tools", async () => {
  const analytics = await import("../dist/analytics.js");
  assert.equal(typeof analytics.connectorReadinessAudit, "function");
  assert.equal(typeof analytics.customerValueCaseBuilder, "function");
  assert.equal(typeof analytics.adoptionExperimentDesigner, "function");
});
