import type { Report } from "./types.js";
import { finding, normalizeItems, objectFrom, recordArray, report, stringFrom } from "./requirementsWorkbench.js";

type InputItem = Record<string, unknown>;

export function requirementTestTraceability(workItems: InputItem[], testCases: Record<string, unknown>[] = []): Report & { writePerformed: false; links: Array<Record<string, unknown>>; approvalRequired: true } {
  const requirements = normalizeItems(workItems).filter((item) => /requirement|story|feature|epic|product backlog item/i.test(item.type));
  const tests = normalizeItems(testCases as InputItem[]).filter((item) => /test/i.test(item.type) || /test/i.test(item.title));
  const links = requirements.flatMap((requirement) => {
    const matches = tests.filter((test) => text(test).includes(key(requirement.title)) || text(requirement).includes(key(test.title)));
    return matches.map((test) => ({
      requirementId: requirement.id,
      testCaseId: test.id,
      relation: "Microsoft.VSTS.Common.TestedBy-Forward",
      confidence: matchConfidence(requirement.title, test.title),
      patchPreview: [{ op: "add", path: "/relations/-", value: { rel: "Microsoft.VSTS.Common.TestedBy-Forward", url: `vstfs:///WorkItemTracking/WorkItem/${test.id}` } }],
      writePerformed: false
    }));
  });
  const findings = requirements.filter((requirement) => !links.some((link) => link.requirementId === requirement.id)).map((requirement) => finding(requirement.id, requirement.title, 80, ["missing linked test case"], "Generate or link at least one Test Case before release."));
  return { ...report("Requirement-Test Traceability", findings, `${links.length} traceability link preview(s) generated.`, { requirements: requirements.length, testCases: tests.length, links: links.length }), writePerformed: false, approvalRequired: true, links };
}

export function testCoverageAnalysis(workItems: InputItem[], testCases: Record<string, unknown>[] = []): Report & { writePerformed: false; coverage: Array<Record<string, unknown>> } {
  const trace = requirementTestTraceability(workItems, testCases);
  const coverage = normalizeItems(workItems).filter((item) => /requirement|story|feature|epic|product backlog item/i.test(item.type)).map((item) => {
    const linked = trace.links.filter((link) => link.requirementId === item.id);
    return { requirementId: item.id, title: item.title, status: linked.length ? "covered" : "missing", linkedTests: linked.length, stale: /changed|updated|new/i.test(item.state) && linked.length > 0 ? "review" : "none" };
  });
  const findings = coverage.filter((entry) => entry.status === "missing" || entry.stale === "review").map((entry) => finding(Number(entry.requirementId), String(entry.title), entry.status === "missing" ? 85 : 60, [`coverage ${entry.status}`, `linked tests ${entry.linkedTests}`], "Create, refresh, or de-duplicate test coverage."));
  return { ...report("Test Coverage Analysis", findings, `${coverage.length} requirement(s) analyzed for test coverage.`, { coverageRows: coverage.length, missing: coverage.filter((entry) => entry.status === "missing").length }), writePerformed: false, coverage };
}

export function defectTraceability(workItems: InputItem[], defects: Record<string, unknown>[] = [], testResults: Record<string, unknown>[] = []): Report & { writePerformed: false; chains: Array<Record<string, unknown>> } {
  const requirements = normalizeItems(workItems);
  const bugs = normalizeItems(defects as InputItem[]).filter((item) => /bug|defect/i.test(item.type) || /bug|defect|failure/i.test(item.title));
  const chains = bugs.map((bug) => {
    const requirement = requirements.find((item) => text(bug).includes(key(item.title)) || text(item).includes(key(bug.title)));
    const result = recordArray(testResults).find((entry) => stringFrom(entry.outcome).toLowerCase().includes("fail") || String(entry.workItemId) === String(bug.id));
    return { defectId: bug.id, defectTitle: bug.title, requirementId: requirement?.id || null, testResult: result ? stringFrom(result.outcome) || "linked" : "missing", confidence: requirement ? 70 : 30 };
  });
  const findings = chains.filter((chain) => !chain.requirementId || chain.testResult === "missing").map((chain) => finding(Number(chain.defectId), String(chain.defectTitle), 75, [`requirement ${chain.requirementId || "missing"}`, `test result ${chain.testResult}`], "Link defect to requirement and failing test evidence."));
  return { ...report("Defect Traceability", findings, `${chains.length} defect traceability chain(s) analyzed.`, { defects: chains.length, incompleteChains: findings.length }), writePerformed: false, chains };
}

export async function applyTraceabilityPlan(args: Record<string, unknown>, azure: { updateWorkItem(input: Record<string, unknown>): Promise<unknown> }): Promise<Record<string, unknown>> {
  if (args.approved !== true || args.confirmPhrase !== "APPLY_TRACEABILITY_PLAN") {
    throw new Error("Traceability writes require approved:true and confirmPhrase APPLY_TRACEABILITY_PLAN.");
  }
  const organization = requiredString(args.organization, "organization");
  const project = requiredString(args.project, "project");
  const plan = objectFrom(args.plan);
  if (plan.writePerformed !== false || plan.approvalRequired !== true || !Array.isArray(plan.links)) {
    throw new Error("plan must be generated by azure_boards_ai_requirement_test_traceability.");
  }
  const results: Array<Record<string, unknown>> = [];
  for (const link of plan.links as Record<string, unknown>[]) {
    try {
      const id = Number(link.requirementId);
      const updated = objectFrom(await azure.updateWorkItem({ organization, project, id, patch: Array.isArray(link.patchPreview) ? link.patchPreview : [] }));
      results.push({ requirementId: id, testCaseId: link.testCaseId, success: true, updatedId: updated.id || id });
    } catch (error) {
      results.push({ requirementId: link.requirementId, testCaseId: link.testCaseId, success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { title: "Traceability Apply Results", generatedAt: new Date().toISOString(), writePerformed: true, summary: `${results.filter((entry) => entry.success).length} traceability link(s) applied.`, metrics: { requested: results.length, succeeded: results.filter((entry) => entry.success).length }, results };
}

function text(item: { title: string; description: string; tags: string[] }): string {
  return `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
}

function key(value: string): string {
  return value.toLowerCase().replace(/test case|bug|defect|requirement|feature|story/g, "").split(/\s+/).filter((part) => part.length > 3).slice(0, 3).join(" ");
}

function matchConfidence(left: string, right: string): number {
  const leftWords = new Set(key(left).split(/\s+/).filter(Boolean));
  const rightWords = new Set(key(right).split(/\s+/).filter(Boolean));
  const overlap = Array.from(leftWords).filter((word) => rightWords.has(word)).length;
  return Math.min(95, 45 + overlap * 20);
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}
