import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const workItems = [
  {
    id: 501,
    type: "Requirement",
    title: "Customer invoice portal",
    state: "Active",
    assignedTo: "Product Owner",
    tags: ["customer", "evidence"],
    description: "Customers need self-service invoice download to reduce support demand and improve transparency.",
    acceptanceCriteria: "Given a customer has invoices, then they can filter and download invoice documents."
  },
  {
    id: 502,
    type: "Bug",
    title: "Invoice portal download failure",
    state: "Active",
    description: "Download fails for customer invoice portal regression.",
    parentId: 501,
    tags: ["customer"]
  }
];

test("requirements workbench supports elicitation, gap analysis, transform, and convert without writes", async () => {
  const module = await import("../dist/requirementsWorkbench.js");
  const elicited = module.elicitRequirements({ keywords: ["customer invoice self service"], notes: ["reduce support tickets"] });
  const gaps = module.requirementGapAnalysis(workItems);
  const transform = module.transformWorkItemText({ text: "Short requirement", operation: "elaborate" });
  const converted = module.convertRequirement({ workItem: workItems[0], target: "gherkin" });

  assert.equal(elicited.writePerformed, false);
  assert.ok(elicited.requirements[0].patchPreview.length > 0);
  assert.equal(gaps.writePerformed, false);
  assert.equal(transform.transforms[0].writePerformed, false);
  assert.match(converted.conversions[0].content, /Feature:/);
});

test("test factory generates previews and guards apply tools", async () => {
  const module = await import("../dist/testFactory.js");
  const plan = module.generateTestCases(workItems);
  const uat = module.generateUatSuite(workItems);
  const regression = module.generateRegressionSuite(workItems);

  assert.equal(plan.writePerformed, false);
  assert.equal(plan.approvalRequired, true);
  assert.ok(plan.testCases[0].assumptions.length > 0);
  assert.ok(uat.suite.length > 0);
  assert.ok(regression.suite.length > 0);
  await assert.rejects(() => module.applyTestCasePlan({ plan }, {}), /approved:true/);
});

test("traceability engine creates link previews, coverage, and defect chains without writes", async () => {
  const module = await import("../dist/traceabilityEngine.js");
  const testCases = [{ id: 7001, type: "Test Case", title: "Test Case - Customer invoice portal", description: "Validate customer invoice download.", tags: [] }];
  const trace = module.requirementTestTraceability(workItems, testCases);
  const coverage = module.testCoverageAnalysis(workItems, testCases);
  const defects = module.defectTraceability(workItems, [workItems[1]], [{ workItemId: 502, outcome: "Failed" }]);

  assert.equal(trace.writePerformed, false);
  assert.equal(trace.approvalRequired, true);
  assert.ok(trace.links.length > 0);
  assert.ok(coverage.coverage.length > 0);
  assert.ok(defects.chains.length > 0);
  await assert.rejects(() => module.applyTraceabilityPlan({ plan: trace }, {}), /approved:true/);
});

test("visual document factory produces mockup, diagram, and SOP artifacts without writes", async () => {
  const module = await import("../dist/visualDocumentFactory.js");
  const mockup = module.generateMockup({ workItem: workItems[0] });
  const diagram = module.generateDiagram({ workItem: workItems[0] });
  const sop = module.generateSopDocument({ workItems, files: [{ name: "notes.txt", text: "Process owner approves the invoice support workflow." }] });

  assert.equal(mockup.writePerformed, false);
  assert.match(String(mockup.mockup.content), /<section/);
  assert.match(String(diagram.diagram.content), /flowchart|@startuml/);
  assert.match(String(sop.document.content), /Standard Operating Procedure/);
});

test("prompt admin validates configuration and renders dynamic prompts without executing tools", async () => {
  const storeDir = path.join(process.cwd(), "tmp-test-store");
  process.env.AZURE_BOARDS_STORE_DIR = storeDir;
  const module = await import(`../dist/promptAdmin.js?cache=${Date.now()}`);
  const saved = module.savePrompt({ name: "status", prompt: "Summarize {{topic}}", allowedToolCategories: ["read-only-analysis"] });
  const listed = module.listPrompts();
  const run = module.runPrompt({ name: "status", variables: { topic: "risks" } });
  const validation = module.validateAdminConfig({ config: { byodEndpoint: "http://example.invalid", models: [{ name: "local" }] } });

  assert.equal(saved.kind, "prompt");
  assert.ok(listed.prompts.some((entry) => entry.name === "status"));
  assert.match(run.promptRun.renderedPrompt, /risks/);
  assert.ok(validation.issues.length >= 1);
});

test("native Azure DevOps extension skeleton is present without token storage markers", () => {
  const root = path.resolve(process.cwd(), "..", "azure-devops-extension");
  const manifestPath = path.join(root, "vss-extension.json");
  const hubPath = path.join(root, "static", "work-item-hub.html");
  const settingsPath = path.join(root, "static", "admin-settings.html");
  assert.equal(existsSync(manifestPath), true);
  assert.equal(existsSync(hubPath), true);
  assert.equal(existsSync(settingsPath), true);

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const combined = `${readFileSync(hubPath, "utf8")}\n${readFileSync(settingsPath, "utf8")}`;
  assert.equal(manifest.manifestVersion, 1);
  assert.ok(manifest.contributions.length >= 2);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|personal access token|oauth token/i);
  assert.match(combined, /MCP backend URL/);
});
