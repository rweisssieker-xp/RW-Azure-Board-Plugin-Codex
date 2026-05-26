import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const pluginRoot = path.resolve(process.cwd(), "..");
const uiRoot = path.join(pluginRoot, "ui");

test("static review UI files are present with expected no-write hooks", () => {
  const indexPath = path.join(uiRoot, "index.html");
  const stylesPath = path.join(uiRoot, "styles.css");
  const appPath = path.join(uiRoot, "app.js");

  assert.equal(existsSync(indexPath), true, "ui/index.html should exist");
  assert.equal(existsSync(stylesPath), true, "ui/styles.css should exist");
  assert.equal(existsSync(appPath), true, "ui/app.js should exist");

  const index = readFileSync(indexPath, "utf8");
  const app = readFileSync(appPath, "utf8");

  for (const hook of ["reportSelector", "runReportButton", "jsonInput", "reportOutput", "markdownPreview"]) {
    assert.match(index, new RegExp(hook), `${hook} should be present in index.html`);
  }

  for (const report of [
    "Delivery Risk Radar",
    "Requirement Decision Cockpit",
    "Portfolio Rationalization",
    "Evidence Ledger",
    "Executive Steering Pack",
    "Bulk Close Preview",
    "Migration Cutover Readiness",
    "Financial Backlog Ledger",
    "Requirement Confidence Score",
    "Requirement Rewrite Studio",
    "Exception Register",
    "Operating Rhythm Planner",
    "OKR Alignment Scorer",
    "Compliance Readiness Review",
    "Handover Pack Generator",
    "Portfolio Fitness Index",
    "Requirements Elicitation Workbench",
    "Requirement Gap Analysis",
    "Work Item Text Transform",
    "Requirement Convert Workbench",
    "Test Case Generation Factory",
    "UAT Suite Generator",
    "Regression Suite Generator",
    "Requirement-Test Traceability",
    "Test Coverage Analysis",
    "Defect Traceability",
    "Mockup Generator",
    "Diagram Generator",
    "SOP Document Generator",
    "Prompt/Admin Preview",
    "Decision Memory",
    "Recommendation Quality Score",
    "Value Inflation Detector",
    "Decision Court",
    "Requirement Contract Lifecycle",
    "Scenario War Room",
    "Autonomous Governance Agent",
    "Business Digital Twin",
    "External Evidence Import",
    "Event Log Process Mining",
    "Stakeholder Influence Map",
    "ROI Confidence Workflow",
    "Enterprise Risk Heatmap",
    "Policy Studio",
    "Prompt Eval Suite",
    "Model Risk Governance",
    "Adoption Cockpit",
    "Connector Readiness Audit",
    "Evidence Ingestion Pipeline",
    "Security Privacy Review",
    "Marketplace Submission Readiness",
    "Organization Rollout Readiness",
    "License Packaging Advisor",
    "Customer Value Case Builder",
    "Proprietary Signal Catalog",
    "Autonomous Followup Scheduler",
    "Adoption Experiment Designer"
  ]) {
    assert.match(app, new RegExp(report), `${report} should be available in app.js`);
  }

  assert.match(app, /Subscription billing validation workflow/, "sample data should use a US-English business example");
  assert.match(app, /Expected annual value USD/, "rewrite previews should use US currency wording");

  assert.doesNotMatch(app, /\bfetch\s*\(/, "static UI must not call fetch");
  assert.doesNotMatch(app, /\bXMLHttpRequest\b/, "static UI must not use XMLHttpRequest");
  assert.doesNotMatch(app, /\bsendBeacon\b/, "static UI must not send beacons");
  assert.match(index, /No Azure writes|Read only/, "index should clearly state no-write mode");
  for (const tab of ["Elicitation", "Convert", "Tests", "Traceability", "Visuals", "Documents", "Prompts/Admin"]) {
    assert.match(index, new RegExp(tab), `${tab} tab should be present in index.html`);
  }
});

test("static UI files do not reintroduce AI, KI, or German-specific marketplace markers", () => {
  const bannedMarkers = [
    ["AI marker", /\bAI\b/i],
    ["KI marker", /\bKI\b/i],
    ["E-Rechnung", /e-rechnung/i],
    ["German language marker", /\bGerman\b|\bDeutsch\b/i],
    ["German compliance keyword", /datenschutz|gesetz/i],
    ["German sample keyword", /automatisiert|rechnung|schnittstelle|umsatz/i],
    ["German customer keyword", /\bkunde\b/i],
    ["German stopword keyword", /\b(und|der|die|das)\b/i],
    ["Euro currency", /\bEUR\b|€/i],
    ["German umlaut or sharp s", /[äöüÄÖÜß]/]
  ];

  const uiFiles = readdirSync(uiRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(uiRoot, entry.name));

  for (const file of uiFiles) {
    const content = readFileSync(file, "utf8");
    for (const [label, pattern] of bannedMarkers) {
      assert.doesNotMatch(content, pattern, `${path.relative(pluginRoot, file)} should not contain ${label}`);
    }
  }
});
