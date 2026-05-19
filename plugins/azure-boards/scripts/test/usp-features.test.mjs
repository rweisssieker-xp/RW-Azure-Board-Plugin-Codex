import test from "node:test";
import assert from "node:assert/strict";

const expectedExports = [
  "projectCockpit",
  "commentIntelligence",
  "roleBasedReport",
  "flowMiningFromUpdates",
  "policyPackSummary"
];

const staleDate = new Date(Date.now() - 21 * 86_400_000).toISOString();
const recentDate = new Date(Date.now() - 2 * 86_400_000).toISOString();

const workItems = [
  {
    id: 101,
    type: "Feature",
    title: "Checkout cockpit needs release owner approval",
    state: "Active",
    assignedTo: "",
    areaPath: "Shop\\Checkout",
    tags: ["release"],
    createdDate: staleDate,
    changedDate: staleDate,
    priority: 1
  },
  {
    id: 102,
    type: "Bug",
    title: "Payment callback intermittently fails",
    state: "Resolved",
    assignedTo: "Grace Hopper",
    areaPath: "Shop\\Payments",
    tags: ["incident"],
    createdDate: recentDate,
    changedDate: recentDate,
    priority: 2
  },
  {
    id: 103,
    type: "User Story",
    title: "Improve invoice export for finance users",
    state: "Done",
    assignedTo: "Ada Lovelace",
    areaPath: "Finance",
    tags: ["finance"],
    createdDate: recentDate,
    changedDate: recentDate,
    priority: 3
  }
];

test("USP analytics exports are available with the expected production contract", async () => {
  const analytics = await import("../dist/analytics.js");
  const missing = expectedExports.filter((name) => typeof analytics[name] !== "function");
  assert.deepEqual(
    missing,
    [],
    `Expected production exports from dist/analytics.js: ${expectedExports.join(", ")}`
  );
});

test("project cockpit summarizes portfolio health without writes", async () => {
  const { projectCockpit } = await importRequiredAnalytics(["projectCockpit"]);
  const report = projectCockpit(workItems, { project: "Demo" });

  assertReportShape(report);
  assert.match(report.title, /cockpit|portfolio|project/i);
  assert.equal(report.writePerformed ?? false, false);
  assert.ok(report.metrics && typeof report.metrics === "object", "projectCockpit should expose metrics");
  assert.ok(report.summary.length > 0);
});

test("comment intelligence detects blocker and decision signals", async () => {
  const { commentIntelligence } = await importRequiredAnalytics(["commentIntelligence"]);
  const report = commentIntelligence(workItems, [
    { id: 1, workItemId: 101, text: "Blocked by legal approval. Need a decision by Friday.", createdDate: staleDate, createdBy: "PM" },
    { id: 2, workItemId: 102, text: "Fix deployed and validated in staging.", createdDate: recentDate, createdBy: "Dev" }
  ]);

  assertReportShape(report);
  const signals = flattenSignals(report);
  assert.match(`${report.summary} ${signals}`, /block|decision|approval/i);
  assert.equal(report.writePerformed ?? false, false);
});

test("role based report adapts findings and actions for the requested role", async () => {
  const { roleBasedReport } = await importRequiredAnalytics(["roleBasedReport"]);
  const report = roleBasedReport(workItems, { role: "Product Owner" });

  assertReportShape(report);
  assert.match(`${report.title} ${report.summary}`, /product owner|role|owner/i);
  assert.ok(Array.isArray(report.nextActions), "roleBasedReport should include role-specific nextActions");
  assert.ok(report.nextActions.length > 0);
});

test("flow mining from updates identifies state transitions and bottlenecks", async () => {
  const { flowMiningFromUpdates } = await importRequiredAnalytics(["flowMiningFromUpdates"]);
  const report = flowMiningFromUpdates(workItems, [
    stateUpdate(101, "New", "Active", staleDate),
    stateUpdate(101, "Active", "Resolved", recentDate),
    stateUpdate(102, "New", "Active", recentDate)
  ]);

  assertReportShape(report);
  assert.match(`${report.title} ${report.summary} ${flattenSignals(report)}`, /flow|transition|state|bottleneck/i);
  assert.ok(report.metrics && typeof report.metrics === "object", "flowMiningFromUpdates should expose flow metrics");
});

test("policy pack summary aggregates governance evidence for multiple policy checks", async () => {
  const { policyPackSummary } = await importRequiredAnalytics(["policyPackSummary"]);
  const report = policyPackSummary(workItems, {
    policies: [
      {
        name: "Release readiness",
        rules: {
          requiredTags: ["release", "audit-ready"],
          allowedTypes: ["Feature", "Bug", "User Story"],
          slaDays: 14
        }
      }
    ]
  });

  assertReportShape(report);
  assert.match(`${report.title} ${report.summary}`, /policy|governance|pack/i);
  assert.ok(report.metrics && typeof report.metrics === "object", "policyPackSummary should expose policy metrics");
  assert.equal(report.writePerformed ?? false, false);
});

async function importRequiredAnalytics(names) {
  const analytics = await import("../dist/analytics.js");
  const missing = names.filter((name) => typeof analytics[name] !== "function");
  assert.deepEqual(missing, [], `Expected production exports from dist/analytics.js: ${names.join(", ")}`);
  return analytics;
}

function assertReportShape(report) {
  assert.equal(typeof report, "object");
  assert.equal(typeof report.title, "string");
  assert.equal(typeof report.summary, "string");
  assert.ok(Array.isArray(report.findings), "report.findings should be an array");
}

function flattenSignals(report) {
  return report.findings.flatMap((finding) => finding.signals || []).join(" ");
}

function stateUpdate(workItemId, oldValue, newValue, changedDate) {
  return {
    id: workItemId,
    workItemId,
    changedDate,
    fields: {
      "System.State": {
        oldValue,
        newValue
      }
    }
  };
}
