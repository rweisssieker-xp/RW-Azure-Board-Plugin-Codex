import test from "node:test";
import assert from "node:assert/strict";

const expectedExports = [
  "watchlistReport",
  "actionPlan",
  "createProcessBaseline",
  "processDriftDetection",
  "costOfDelayRadar",
  "processSimulator",
  "capacityForecast",
  "briefExport"
];

const staleDate = new Date(Date.now() - 28 * 86_400_000).toISOString();
const olderDate = new Date(Date.now() - 55 * 86_400_000).toISOString();
const recentDate = new Date(Date.now() - 2 * 86_400_000).toISOString();

const workItems = [
  {
    id: 201,
    type: "Feature",
    title: "Enterprise checkout migration blocked by payment gateway decision",
    state: "Active",
    assignedTo: "",
    areaPath: "Shop\\Checkout",
    tags: ["strategic", "revenue", "watchlist"],
    createdDate: olderDate,
    changedDate: staleDate,
    priority: 1
  },
  {
    id: 202,
    type: "Bug",
    title: "Production invoice export outage impacts finance users",
    state: "New",
    assignedTo: "Grace Hopper",
    areaPath: "Finance",
    tags: ["customer", "incident"],
    createdDate: staleDate,
    changedDate: staleDate,
    priority: 1
  },
  {
    id: 203,
    type: "User Story",
    title: "Add renewal dashboard filters for account managers",
    state: "Done",
    assignedTo: "Ada Lovelace",
    areaPath: "Sales",
    tags: ["retention"],
    createdDate: olderDate,
    changedDate: recentDate,
    priority: 3
  },
  {
    id: 204,
    type: "Task",
    title: "Document support handoff checklist",
    state: "Code Review",
    assignedTo: "Linus Torvalds",
    areaPath: "Support",
    tags: ["process"],
    createdDate: staleDate,
    changedDate: staleDate,
    priority: 4
  }
];

const updates = [
  stateUpdate(201, "New", "Active", olderDate),
  stateUpdate(201, "Active", "Blocked", staleDate),
  stateUpdate(202, "New", "Active", staleDate),
  stateUpdate(202, "Active", "New", recentDate),
  stateUpdate(204, "Active", "Code Review", staleDate)
];

test("advanced USP analytics exports are available with the expected production contract", async () => {
  const analytics = await import("../dist/analytics.js");
  const missing = expectedExports.filter((name) => typeof analytics[name] !== "function");
  assert.deepEqual(
    missing,
    [],
    `Expected advanced USP exports from dist/analytics.js: ${expectedExports.join(", ")}`
  );
});

test("watchlistReport prioritizes stale, blocked, high-impact work without writes", async () => {
  const { watchlistReport } = await importRequiredAnalytics(["watchlistReport"]);
  const report = watchlistReport(workItems, { focusTags: ["watchlist", "revenue"], maxItems: 5 });

  assertReportShape(report);
  assert.equal(report.writePerformed ?? false, false);
  assert.match(`${report.title} ${report.summary} ${flattenSignals(report)}`, /watchlist|stale|blocked|priority|revenue/i);
  assert.ok(report.findings.length > 0, "watchlistReport should return prioritized findings");
});

test("actionPlan turns risks into concrete next actions", async () => {
  const { actionPlan } = await importRequiredAnalytics(["actionPlan"]);
  const report = actionPlan(workItems, { role: "Delivery Lead", horizonDays: 14 });

  assertReportShape(report);
  assert.equal(report.writePerformed ?? false, false);
  assert.ok(Array.isArray(report.nextActions), "actionPlan should expose nextActions");
  assert.ok(report.nextActions.length > 0, "actionPlan should produce at least one next action");
  assert.match(`${report.title} ${report.summary} ${report.nextActions.join(" ")}`, /action|owner|next|lead|delivery|plan/i);
});

test("createProcessBaseline captures measurable process metrics for later comparison", async () => {
  const { createProcessBaseline } = await importRequiredAnalytics(["createProcessBaseline"]);
  const baseline = createProcessBaseline(workItems, updates, { name: "Release readiness" });

  assert.equal(typeof baseline, "object");
  assert.equal(baseline.writePerformed ?? false, false);
  assert.ok(baseline.metrics && typeof baseline.metrics === "object", "baseline should expose metrics");
  assert.match(`${baseline.title || ""} ${baseline.summary || ""} ${Object.keys(baseline.metrics).join(" ")}`, /baseline|process|flow|cycle|throughput|wip/i);
});

test("processDriftDetection compares current evidence against a baseline", async () => {
  const { createProcessBaseline, processDriftDetection } = await importRequiredAnalytics([
    "createProcessBaseline",
    "processDriftDetection"
  ]);
  const baseline = createProcessBaseline(workItems.slice(2), updates.slice(4), { name: "Healthy baseline" });
  const report = processDriftDetection(workItems, baseline, { tolerancePercent: 10 });

  assertReportShape(report);
  assert.equal(report.writePerformed ?? false, false);
  assert.match(`${report.title} ${report.summary} ${flattenSignals(report)}`, /drift|baseline|change|variance|deviation/i);
  assert.ok(report.metrics && typeof report.metrics === "object", "processDriftDetection should expose comparison metrics");
});

test("costOfDelayRadar ranks economically urgent work", async () => {
  const { costOfDelayRadar } = await importRequiredAnalytics(["costOfDelayRadar"]);
  const report = costOfDelayRadar(workItems, {
    valueByTag: { revenue: 50000, customer: 25000, strategic: 40000 },
    delayCostPerDay: 1000
  });

  assertReportShape(report);
  assert.equal(report.writePerformed ?? false, false);
  assert.match(`${report.title} ${report.summary} ${flattenSignals(report)}`, /cost|delay|value|economic|revenue|customer/i);
  assert.ok(report.findings.length > 0, "costOfDelayRadar should rank urgent work");
});

test("processSimulator evaluates a proposed process change without writing", async () => {
  const { processSimulator } = await importRequiredAnalytics(["processSimulator"]);
  const report = processSimulator(workItems, {
    scenario: "Add WIP limit of 2 for Code Review and expedite priority 1 work",
    wipLimit: 2,
    expeditePriority: 1
  });

  assertReportShape(report);
  assert.equal(report.writePerformed ?? false, false);
  assert.match(`${report.title} ${report.summary} ${flattenSignals(report)}`, /simulat|scenario|wip|impact|forecast/i);
  assert.ok(report.metrics && typeof report.metrics === "object", "processSimulator should expose scenario metrics");
});

test("capacityForecast projects delivery capacity from current board evidence", async () => {
  const { capacityForecast } = await importRequiredAnalytics(["capacityForecast"]);
  const report = capacityForecast(workItems, {
    teamCapacityPerWeek: 3,
    horizonWeeks: 4,
    averageThroughputPerWeek: 2
  });

  assertReportShape(report);
  assert.equal(report.writePerformed ?? false, false);
  assert.match(`${report.title} ${report.summary} ${flattenSignals(report)}`, /capacity|forecast|throughput|week|demand/i);
  assert.ok(report.metrics && typeof report.metrics === "object", "capacityForecast should expose capacity metrics");
});

test("briefExport converts a report into a portable briefing artifact", async () => {
  const { briefExport, actionPlan } = await importRequiredAnalytics(["briefExport", "actionPlan"]);
  const sourceReport = actionPlan(workItems, { role: "Executive" });
  const exported = briefExport(sourceReport, { format: "markdown", audience: "executive" });

  assert.equal(typeof exported, "object");
  assert.equal(exported.writePerformed ?? false, false);
  assert.match(`${exported.title || ""} ${exported.summary || ""} ${exported.format || ""}`, /brief|export|markdown|executive/i);
  assert.ok(
    typeof exported.content === "string" || typeof exported.markdown === "string" || Array.isArray(exported.sections),
    "briefExport should expose content, markdown, or sections"
  );
});

async function importRequiredAnalytics(names) {
  const analytics = await import("../dist/analytics.js");
  const missing = names.filter((name) => typeof analytics[name] !== "function");
  assert.deepEqual(missing, [], `Expected advanced USP exports from dist/analytics.js: ${names.join(", ")}`);
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
