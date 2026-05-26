import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  adminConsoleConfig,
  approvalApplyPlan,
  approvalQueue,
  approvalResultReview,
  auditTrail,
  automatedReminderPlan,
  createPersistentBaseline,
  createPersistentSnapshot,
  decisionPackExport,
  decisionPackImport,
  roleCockpitConfig
} from "../dist/productOperatingSystem.js";

const items = [
  {
    id: 501,
    type: "Requirement",
    title: "Finance close evidence automation",
    state: "Active",
    assignedTo: "Mira Finance",
    priority: 1,
    tags: ["Finance", "Compliance"],
    changedDate: "2026-03-01T09:00:00Z",
    description: "Automate finance close evidence and approvals.",
    acceptanceCriteria: "Evidence is linked and approved.",
    areaPath: "Finance\\Close"
  },
  {
    id: 502,
    type: "User Story",
    title: "Portal status wording cleanup",
    state: "New",
    assignedTo: "",
    priority: 3,
    tags: ["Customer"],
    changedDate: "2026-02-01T09:00:00Z",
    description: "Clarify customer portal payment status wording.",
    acceptanceCriteria: ""
  },
  {
    id: 503,
    type: "Requirement",
    title: "Closed duplicate warehouse label request",
    state: "Closed",
    assignedTo: "Nina Ops",
    priority: 4,
    tags: ["Warehouse"],
    changedDate: "2026-04-01T09:00:00Z",
    description: "Duplicate request closed after review.",
    acceptanceCriteria: "Closure rationale recorded.",
    fields: { "Custom.TargetBenefit": 42000 }
  }
];

test("product operating system persists snapshots and baselines", () => {
  const store = mkdtempSync(path.join(tmpdir(), "azb-store-"));
  const previous = process.env.AZURE_BOARDS_STORE_DIR;
  process.env.AZURE_BOARDS_STORE_DIR = store;
  try {
    const snapshot = createPersistentSnapshot("weekly-control", items, [{ workItemId: 501, text: "Approved evidence." }], {});
    const baseline = createPersistentBaseline("release-baseline", items, [], { requiredTags: ["Compliance"] });

    assert.equal(snapshot.kind, "process-snapshot");
    assert.equal(snapshot.name, "weekly-control");
    assert.equal(snapshot.data.writePerformed, false);
    assert.equal(typeof snapshot.data.fingerprint, "string");
    assert.equal(baseline.kind, "process-baseline");
    assert.equal(baseline.data.baseline.writePerformed, false);
  } finally {
    if (previous === undefined) delete process.env.AZURE_BOARDS_STORE_DIR;
    else process.env.AZURE_BOARDS_STORE_DIR = previous;
    rmSync(store, { recursive: true, force: true });
  }
});

test("approval queue, audit trail, roles, admin, reminders, and decision pack are productized no-write flows", () => {
  const queue = approvalQueue(items, [{ id: "a1", workItemId: 501, recommendation: "Approve closure evidence after review." }], {});
  assert.equal(queue.writePerformed, false);
  assert.equal(queue.approvalRequired, true);
  assert.equal(queue.queue[0].requiresHumanApproval, true);
  assert.deepEqual(queue.queue[0].verification, ["Re-read Work Item before apply.", "Apply only selected approved items.", "Re-query and record outcome."]);

  const applyPlan = approvalApplyPlan(queue.queue, { selectedIds: ["a1"], actor: "Mira Finance", rationale: "Evidence reviewed." });
  assert.equal(applyPlan.writePerformed, false);
  assert.equal(applyPlan.plan[0].status, "needs-secondary-approval");
  assert.equal(applyPlan.auditEvents[0].action, "accepted");

  const resultReview = approvalResultReview([{ ...applyPlan.plan[0], status: "ready-for-apply" }], [{ recommendationId: "a1", workItemId: 501, success: true }], items);
  assert.equal(resultReview.writePerformed, false);
  assert.equal(resultReview.verification[0].verified, true);
  assert.equal(resultReview.auditEvents[0].outcome, "verified");

  const trail = auditTrail([{ workItemId: 501, actor: "Mira Finance", action: "accepted", rationale: "Evidence checked." }]);
  assert.equal(trail.writePerformed, false);
  assert.equal(trail.trail[0].action, "accepted");
  assert.equal(trail.metrics.accepted, 1);

  const roles = roleCockpitConfig(items, { roles: ["product-owner", "scrum-master", "cio", "compliance"] });
  assert.equal(roles.writePerformed, false);
  assert.equal(roles.cockpits.length, 4);
  assert.ok(roles.cockpits.some((cockpit) => cockpit.title === "CIO Portfolio Cockpit"));

  const admin = adminConsoleConfig({ hostedMcpUrl: "https://mcp.example.com", llmMode: "deterministic-local", clientId: "client" });
  assert.equal(admin.writePerformed, false);
  assert.equal(admin.config.thresholds.slaDays, 14);
  assert.ok(admin.validation.some((control) => control.name === "hosted MCP" && control.ready === true));

  const reminders = automatedReminderPlan(items, { cadenceDays: 5, benefitCadenceDays: 30 });
  assert.equal(reminders.writePerformed, false);
  assert.ok(reminders.reminders.length >= 1);
  assert.equal(typeof reminders.reminders[0].schedule.rrule, "string");
  assert.match(reminders.reminders[0].automationPrompt, /Review/);

  const pack = decisionPackExport(items, [{ workItemId: 501, text: "Finance sign-off attached." }], { audience: "cio" });
  assert.equal(pack.writePerformed, false);
  assert.match(pack.markdown, /Steering Pack/);
  assert.match(pack.markdown, /Audit Pack/);
  assert.ok(pack.pack.sections.auditPack);
  assert.equal(pack.pack.exports.includes("markdown"), true);
  assert.equal(pack.manifest.schema, "rw.azureBoards.decisionPack.v1");

  const imported = decisionPackImport({ pack: pack.pack, markdown: pack.markdown });
  assert.equal(imported.writePerformed, false);
  assert.equal(imported.imported.ready, true);
});
