import test from "node:test";
import assert from "node:assert/strict";
import {
  deliveryRiskRadar,
  governanceScore,
  improveWorkItem,
  naturalLanguageToWiql,
  slaAgingMonitor,
  workflowConformance
} from "../dist/analytics.js";

const staleDate = new Date(Date.now() - 40 * 86_400_000).toISOString();
const recentDate = new Date(Date.now() - 2 * 86_400_000).toISOString();

const items = [
  {
    id: 1,
    type: "Bug",
    title: "Blocked checkout regression waiting for approval",
    state: "Active",
    tags: ["release"],
    createdDate: staleDate,
    changedDate: staleDate,
    priority: 1
  },
  {
    id: 2,
    type: "User Story",
    title: "Improve invoice export",
    state: "Done",
    assignedTo: "Ada",
    tags: ["finance"],
    createdDate: recentDate,
    changedDate: recentDate
  }
];

test("delivery risk radar explains high-risk items", () => {
  const report = deliveryRiskRadar(items);
  assert.equal(report.title, "AI Delivery Risk Radar");
  assert.equal(report.findings[0].id, 1);
  assert.ok(report.findings[0].signals.some((signal) => signal.includes("open for")));
  assert.ok((report.findings[0].score ?? 0) > 80);
});

test("SLA monitor reports stale open items only", () => {
  const report = slaAgingMonitor(items, 14);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].id, 1);
});

test("workflow conformance uses configured policy", () => {
  const report = workflowConformance(items, { requiredTags: ["release"], allowedTypes: ["Bug"] });
  assert.ok(report.findings.some((finding) => finding.id === 2));
});

test("governance score is bounded", () => {
  const report = governanceScore(items, { requiredTags: ["release"] });
  assert.equal(typeof report.metrics.governanceScore, "number");
  assert.ok(report.metrics.governanceScore >= 0);
  assert.ok(report.metrics.governanceScore <= 100);
});

test("ticket doctor returns patch preview without writing", () => {
  const result = improveWorkItem({ type: "Bug", title: "Bad" });
  assert.equal(result.writePerformed, false);
  assert.ok(Array.isArray(result.patchPreview));
});

test("natural language to WIQL creates conservative query", () => {
  const result = naturalLanguageToWiql({ project: "Demo", query: "open high bugs" });
  assert.match(result.wiql, /WorkItemType/);
  assert.match(result.wiql, /Priority/);
  assert.equal(result.writePerformed, false);
});

