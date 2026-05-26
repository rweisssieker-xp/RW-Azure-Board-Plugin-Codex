import type { Report } from "./types.js";
import { finding, normalizeItems, objectFrom, recordArray, report, stringFrom } from "./requirementsWorkbench.js";

type InputItem = Record<string, unknown>;

const CLOSED_STATES = new Set(["closed", "done", "completed", "resolved", "removed", "inactive"]);

export function decisionMemory(workItems: InputItem[], decisions: Record<string, unknown>[] = [], outcomes: Record<string, unknown>[] = []): Report & { writePerformed: false; memory: Array<Record<string, unknown>> } {
  const items = normalizeItems(workItems);
  const memory = decisions.map((decision, index) => {
    const itemId = numberFrom(decision.workItemId) ?? numberFrom(decision.id) ?? index + 1;
    const item = items.find((candidate) => candidate.id === itemId);
    const outcome = outcomes.find((entry) => (numberFrom(entry.workItemId) ?? numberFrom(entry.id)) === itemId);
    return {
      workItemId: itemId,
      title: item?.title || stringFrom(decision.title) || `Decision ${index + 1}`,
      decision: stringFrom(decision.decision) || stringFrom(decision.action) || "unknown",
      rationale: stringFrom(decision.rationale) || stringFrom(decision.reason) || "No rationale supplied.",
      decidedBy: stringFrom(decision.decidedBy) || stringFrom(decision.actor) || item?.assignedTo || "unknown",
      outcomeStatus: outcome ? stringFrom(outcome.status) || "observed" : "not observed",
      outcomeEvidence: outcome ? stringFrom(outcome.evidence) || stringFrom(outcome.summary) : "",
      confidence: outcome ? 80 : 45
    };
  });
  const findings = memory.filter((entry) => entry.outcomeStatus === "not observed").map((entry) => finding(Number(entry.workItemId), String(entry.title), 65, [`decision ${entry.decision}`, "missing outcome"], "Add outcome evidence so future decisions can be audited."));
  return { ...report("Decision Memory", findings, `${memory.length} decision memory entrie(s) assembled.`, { decisions: memory.length, missingOutcomes: findings.length }), writePerformed: false, memory };
}

export function recommendationQualityScore(recommendations: Record<string, unknown>[] = [], outcomes: Record<string, unknown>[] = []): Report & { writePerformed: false; scores: Array<Record<string, unknown>> } {
  const scores = recommendations.map((recommendation, index) => {
    const id = numberFrom(recommendation.workItemId) ?? numberFrom(recommendation.id) ?? index + 1;
    const action = stringFrom(recommendation.recommendation) || stringFrom(recommendation.action) || "unknown";
    const outcome = outcomes.find((entry) => (numberFrom(entry.workItemId) ?? numberFrom(entry.id)) === id);
    const status = qualityStatus(action, outcome);
    const score = status === "confirmed" ? 90 : status === "reversed" ? 25 : status === "stale" ? 45 : 50;
    return { workItemId: id, action, status, score, outcome: outcome ? stringFrom(outcome.status) || stringFrom(outcome.decision) : "missing", learning: learningFor(status) };
  });
  const findings = scores.filter((entry) => entry.status !== "confirmed").map((entry) => finding(Number(entry.workItemId), String(entry.action), 100 - Number(entry.score), [`status ${entry.status}`, `outcome ${entry.outcome}`], String(entry.learning)));
  return { ...report("Recommendation Quality Score", findings, `${scores.length} recommendation(s) scored against supplied outcomes.`, { recommendations: scores.length, weakRecommendations: findings.length }), writePerformed: false, scores };
}

export function valueInflationDetector(workItems: InputItem[], options: Record<string, unknown> = {}): Report & { writePerformed: false; inflation: Array<Record<string, unknown>> } {
  const threshold = positive(options.threshold, 70);
  const inflation = normalizeItems(workItems).map((item) => {
    const fields = objectFrom(item.raw.fields);
    const businessValue = numberFrom(fields["Custom.BusinessValue"]) ?? numberFrom(fields["Microsoft.VSTS.Common.BusinessValue"]) ?? 0;
    const costOfDelay = numberFrom(fields["Custom.CostOfDelay"]) ?? 0;
    const evidenceScore = (item.description.length >= 100 ? 30 : 5) + (item.acceptanceCriteria.length >= 40 ? 25 : 0) + (item.assignedTo ? 15 : 0) + (item.tags.some((tag) => /evidence|approved|validated|audit/i.test(tag)) ? 20 : 0);
    const claimedScore = Math.min(100, businessValue * 10 + Math.min(30, costOfDelay / 1000));
    const inflationScore = Math.max(0, Math.round(claimedScore - evidenceScore));
    return { id: item.id, title: item.title, businessValue, costOfDelay, evidenceScore, inflationScore, status: inflationScore >= threshold ? "inflated" : inflationScore >= 35 ? "challenge" : "supported" };
  }).sort((a, b) => Number(b.inflationScore) - Number(a.inflationScore));
  const findings = inflation.filter((entry) => entry.status !== "supported").map((entry) => finding(Number(entry.id), String(entry.title), Number(entry.inflationScore), [`business value ${entry.businessValue}`, `evidence score ${entry.evidenceScore}`], "Challenge claimed value or request stronger benefit evidence."));
  return { ...report("Value Inflation Detector", findings, `${inflation.length} Work Item(s) checked for inflated value claims.`, { assessedItems: inflation.length, challenged: findings.length }), writePerformed: false, inflation };
}

export function decisionCourt(workItems: InputItem[], recommendations: Record<string, unknown>[] = []): Report & { writePerformed: false; cases: Array<Record<string, unknown>> } {
  const recs = recordArray(recommendations);
  const cases = normalizeItems(workItems).map((item) => {
    const recommendation = recs.find((entry) => (numberFrom(entry.workItemId) ?? numberFrom(entry.id)) === item.id);
    const action = stringFrom(recommendation?.recommendation) || stringFrom(recommendation?.action) || defaultDecision(item);
    const pro = proArguments(item, action);
    const contra = contraArguments(item, action);
    const missingFacts = missingFactsFor(item);
    return { id: item.id, title: item.title, action, pro, contra, missingFacts, verdict: missingFacts.length > 1 ? "defer pending evidence" : action, confidence: Math.max(20, 90 - missingFacts.length * 18 - contra.length * 6) };
  });
  const findings = cases.filter((entry) => (entry.missingFacts as string[]).length || (entry.contra as string[]).length > 1).map((entry) => finding(Number(entry.id), String(entry.title), 100 - Number(entry.confidence), [`action ${entry.action}`, `missing ${(entry.missingFacts as string[]).join(", ") || "none"}`], "Review court arguments before approving the recommendation."));
  return { ...report("Decision Court", findings, `${cases.length} decision court case(s) prepared.`, { cases: cases.length, contested: findings.length }), writePerformed: false, cases };
}

export function requirementContractLifecycle(workItems: InputItem[], options: Record<string, unknown> = {}): Report & { writePerformed: false; contracts: Array<Record<string, unknown>> } {
  const reviewDays = positive(options.reviewDays, 60);
  const contracts = normalizeItems(workItems).filter((item) => /requirement|story|feature|epic|product backlog item/i.test(item.type)).map((item) => {
    const metric = metricFor(item);
    const contractText = [
      `Problem: ${firstSentence(item.description) || item.title}`,
      `Outcome metric: ${metric}`,
      "Baseline: to be confirmed by accountable owner.",
      "Target value: to be confirmed before implementation.",
      `Owner: ${item.assignedTo || "unassigned"}`,
      `Review cadence: ${reviewDays} days after closure.`,
      "Exit criterion: measurable outcome and evidence are recorded."
    ].join("\n");
    return { id: item.id, title: item.title, metric, owner: item.assignedTo || "unassigned", reviewDays, contractText, status: item.assignedTo ? "draft-ready" : "owner-missing", patchPreview: [{ op: item.description ? "replace" : "add", path: "/fields/System.Description", value: contractText }], writePerformed: false };
  });
  const findings = contracts.map((contract) => finding(Number(contract.id), String(contract.title), contract.status === "owner-missing" ? 80 : 55, [`status ${contract.status}`, `metric ${contract.metric}`], "Review the outcome contract before applying the Description patch."));
  return { ...report("Requirement Contract Lifecycle", findings, `${contracts.length} outcome contract draft(s) generated.`, { contracts: contracts.length }), writePerformed: false, contracts };
}

export function scenarioWarRoom(workItems: InputItem[], scenarios: Record<string, unknown>[] = []): Report & { writePerformed: false; scenarios: Array<Record<string, unknown>> } {
  const items = normalizeItems(workItems);
  const scenarioInputs = scenarios.length ? scenarios : [
    { name: "Budget minus 20 percent", budgetFactor: 0.8, goLiveFixed: false },
    { name: "Fixed go-live", budgetFactor: 1, goLiveFixed: true },
    { name: "Compliance priority", budgetFactor: 1, complianceFirst: true }
  ];
  const rows = scenarioInputs.map((scenario) => {
    const name = stringFrom(scenario.name) || "Scenario";
    const budgetFactor = numberFrom(scenario.budgetFactor) ?? 1;
    const atRisk = items.filter((item) => scenarioRisk(item, scenario)).map((item) => item.id);
    const protectedItems = items.filter((item) => /compliance|audit|regulatory|customer|finance|production/i.test(`${item.title} ${item.description} ${item.tags.join(" ")}`)).map((item) => item.id);
    return { name, budgetFactor, atRisk, protectedItems, recommendation: atRisk.length > protectedItems.length ? "reduce scope and protect critical controls" : "maintain scope with governance watchlist", confidence: Math.max(35, 85 - atRisk.length * 5) };
  });
  const findings = rows.map((row) => finding(undefined, String(row.name), 100 - Number(row.confidence), [`at risk ${(row.atRisk as number[]).length}`, `protected ${(row.protectedItems as number[]).length}`], String(row.recommendation)));
  return { ...report("Scenario War Room", findings, `${rows.length} management scenario(s) simulated.`, { scenarios: rows.length }), writePerformed: false, scenarios: rows };
}

export function autonomousGovernanceAgent(workItems: InputItem[], evidence: Record<string, unknown>[] = [], options: Record<string, unknown> = {}): Report & { writePerformed: false; agenda: Array<Record<string, unknown>>; watchlist: Array<Record<string, unknown>>; actionPreviews: Array<Record<string, unknown>> } {
  const staleDays = positive(options.staleDays, 45);
  const items = normalizeItems(workItems);
  const watchlist = items.filter((item) => !isClosed(item) && (!item.assignedTo || item.description.length < 80 || daysSince(item) > staleDays || /block|risk|delay|exception|waiver/i.test(`${item.title} ${item.description}`))).map((item) => ({
    id: item.id,
    title: item.title,
    reason: [!item.assignedTo ? "missing owner" : "", item.description.length < 80 ? "weak description" : "", daysSince(item) > staleDays ? "stale" : "", /block|risk|delay|exception|waiver/i.test(`${item.title} ${item.description}`) ? "risk language" : ""].filter(Boolean),
    evidence: evidence.filter((entry) => (numberFrom(entry.workItemId) ?? numberFrom(entry.id)) === item.id).length
  }));
  const agenda = [
    { topic: "Top governance risks", itemIds: watchlist.slice(0, 10).map((entry) => entry.id), decisionNeeded: "assign owner, improve evidence, close, or accept risk" },
    { topic: "Outcome contracts due", itemIds: items.filter((item) => /requirement|story|feature/i.test(item.type) && item.description.length < 120).slice(0, 10).map((item) => item.id), decisionNeeded: "approve outcome contract draft" },
    { topic: "Value challenge review", itemIds: items.filter((item) => /high|urgent|priority/i.test(`${item.title} ${item.tags.join(" ")}`) && item.description.length < 80).slice(0, 10).map((item) => item.id), decisionNeeded: "request benefit evidence or reprioritize" }
  ];
  const actionPreviews = watchlist.slice(0, 20).map((entry) => ({ id: entry.id, title: entry.title, patchPreview: [{ op: "add", path: "/fields/System.Tags", value: "Governance Review" }], rationale: `Governance watchlist: ${(entry.reason as string[]).join(", ")}`, writePerformed: false }));
  const findings = watchlist.map((entry) => finding(Number(entry.id), String(entry.title), 75, entry.reason as string[], "Review in the next governance cycle and approve any patch separately."));
  return { ...report("Autonomous Governance Agent", findings, `${watchlist.length} watchlist item(s), ${agenda.length} agenda block(s), and ${actionPreviews.length} action preview(s) prepared.`, { watchlist: watchlist.length, agenda: agenda.length, actionPreviews: actionPreviews.length }), writePerformed: false, agenda, watchlist, actionPreviews };
}

function defaultDecision(item: { state: string; description: string; acceptanceCriteria: string }): string {
  if (isClosed(item)) return "verify outcome";
  if (item.description.length < 80 || item.acceptanceCriteria.length < 40) return "defer pending evidence";
  return "continue with controls";
}

function proArguments(item: { assignedTo: string; description: string; acceptanceCriteria: string; tags: string[] }, action: string): string[] {
  const args = [];
  if (/close|defer/i.test(action) && item.description.length < 80) args.push("weak decision-grade description");
  if (/continue|build|keep/i.test(action) && item.acceptanceCriteria.length >= 40) args.push("acceptance criteria present");
  if (item.assignedTo) args.push("accountable owner present");
  if (item.tags.some((tag) => /evidence|audit|approved/i.test(tag))) args.push("evidence tag present");
  return args.length ? args : ["recommendation has plausible board signals"];
}

function contraArguments(item: { assignedTo: string; description: string; acceptanceCriteria: string }, action: string): string[] {
  const args = [];
  if (/close|defer/i.test(action) && item.acceptanceCriteria.length >= 40) args.push("acceptance criteria may indicate real delivery scope");
  if (/continue|build|keep/i.test(action) && item.description.length < 80) args.push("business problem is weakly documented");
  if (!item.assignedTo) args.push("missing accountable owner");
  return args;
}

function missingFactsFor(item: { assignedTo: string; description: string; acceptanceCriteria: string }): string[] {
  return [item.assignedTo ? "" : "owner", item.description.length >= 80 ? "" : "problem/value", item.acceptanceCriteria.length >= 40 ? "" : "acceptance"].filter(Boolean);
}

function metricFor(item: { title: string; description: string; tags: string[] }): string {
  const text = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
  if (/support|ticket|customer/.test(text)) return "support ticket reduction or customer self-service rate";
  if (/finance|invoice|billing|cost/.test(text)) return "financial cycle time, cost reduction, or invoice accuracy";
  if (/regulatory|audit|compliance/.test(text)) return "audit finding count or compliance evidence completeness";
  if (/production|warehouse|inventory/.test(text)) return "process throughput, error rate, or inventory accuracy";
  return "measurable business process outcome";
}

function scenarioRisk(item: { description: string; title: string; tags: string[]; assignedTo: string }, scenario: Record<string, unknown>): boolean {
  const text = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
  if (numberFrom(scenario.budgetFactor) !== undefined && Number(scenario.budgetFactor) < 1 && !/compliance|regulatory|finance|customer/.test(text)) return true;
  if (scenario.goLiveFixed === true && /block|delay|risk|dependency/.test(text)) return true;
  if (scenario.complianceFirst === true && !/compliance|regulatory|audit|security/.test(text) && !item.assignedTo) return true;
  return false;
}

function qualityStatus(action: string, outcome: Record<string, unknown> | undefined): string {
  if (!outcome) return "unknown";
  const status = `${stringFrom(outcome.status)} ${stringFrom(outcome.decision)} ${stringFrom(outcome.outcome)}`.toLowerCase();
  if (/reversed|reopened|failed|wrong/.test(status)) return "reversed";
  if (/stale|no evidence|missing/.test(status)) return "stale";
  if (/confirmed|accepted|successful|realized|closed/.test(status)) return "confirmed";
  return /close|defer/i.test(action) && /built|implemented/i.test(status) ? "reversed" : "unknown";
}

function learningFor(status: string): string {
  if (status === "confirmed") return "Keep similar scoring signals.";
  if (status === "reversed") return "Reduce confidence for similar recommendations until stronger evidence exists.";
  if (status === "stale") return "Require outcome evidence before considering the recommendation validated.";
  return "Insufficient outcome evidence for learning.";
}

function isClosed(item: { state: string }): boolean {
  return CLOSED_STATES.has(String(item.state || "").toLowerCase());
}

function daysSince(item: { raw: Record<string, unknown> }): number {
  const fields = objectFrom(item.raw.fields);
  const value = stringFrom(item.raw.changedDate) || stringFrom(fields["System.ChangedDate"]);
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86_400_000)) : 0;
}

function firstSentence(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  const match = clean.match(/^(.{1,220}?)(?:[.!?]\s|$)/);
  return (match ? match[1] : clean.slice(0, 220)).trim();
}

function numberFrom(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function positive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
