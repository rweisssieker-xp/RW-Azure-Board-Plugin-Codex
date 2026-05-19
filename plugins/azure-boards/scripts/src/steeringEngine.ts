import type { Finding, Report, WorkItem, WorkItemSummary } from "./types.js";

const CLOSED_STATES = new Set(["closed", "done", "completed", "resolved", "removed", "inactive"]);
const DECISION_TERMS = /\b(decision|approved|approval|rejected|accepted|deferred|waived|exception|sign[- ]?off|close|closed)\b/i;
const EVIDENCE_TERMS = /\b(evidence|audit|test|qa|review|attachment|validated|verified|build|release|comment|decision)\b/i;

const PROCESS_AREAS: Array<{ name: string; keywords: RegExp; multiplier: number }> = [
  { name: "Finance Closing", keywords: /closing|abschluss|ledger|konto|buchung|faktura|invoice|rechnung|tax|vat|payment/i, multiplier: 1.3 },
  { name: "Order-to-Cash", keywords: /order|auftrag|cash|customer|kunde|crm|delivery|lieferschein|sales|portal/i, multiplier: 1.2 },
  { name: "Procure-to-Pay", keywords: /procure|purchase|einkauf|supplier|vendor|kreditor|payable|rechnungseingang/i, multiplier: 1.15 },
  { name: "Manufacturing", keywords: /production|produktion|fertigung|bde|arbeitsplan|charge|shopfloor|kanban/i, multiplier: 1.2 },
  { name: "Warehouse", keywords: /warehouse|lager|material|kommission|packraum|inventory|bestand|logistics/i, multiplier: 1.15 },
  { name: "Master Data", keywords: /master data|stammdaten|artikel|item master|mapping|adresse|supplier|customer master/i, multiplier: 1.1 },
  { name: "Regulatory", keywords: /regulatory|compliance|audit|gesetz|gdpr|datenschutz|udi|gudid|eudamed|zoll|e-rechnung/i, multiplier: 1.35 },
  { name: "Integration Backbone", keywords: /integration|schnittstelle|api|ssis|webservice|xml|csv|datalake|export|import|wup|addone/i, multiplier: 1.25 }
];

const BENEFIT_FIELDS = ["Custom.TargetBenefit", "Custom.ExpectedBenefit", "Custom.AnnualBenefit", "Custom.Benefit", "Business.TargetBenefit"];
const REALIZED_FIELDS = ["Custom.RealizedBenefit", "Custom.ActualBenefit", "Custom.BenefitRealized", "Business.RealizedBenefit"];
const COST_FIELDS = ["Custom.Cost", "Custom.EstimatedCost", "Custom.Budget", "Microsoft.VSTS.Scheduling.OriginalEstimate"];
const VALUE_FIELDS = ["Custom.BusinessValue", "Microsoft.VSTS.Common.BusinessValue", "Custom.CostOfDelay"];
const EFFORT_FIELDS = ["Custom.JobDuration", "Custom.Effort", "Microsoft.VSTS.Scheduling.Effort", "Microsoft.VSTS.Scheduling.StoryPoints"];

export interface SteeringOptions {
  asOfDate?: string;
  staleDays?: number;
  defaultDailyCost?: number;
  defaultItemCost?: number;
  includeHtml?: boolean;
  policy?: Record<string, unknown>;
}

type InputItem = WorkItem | WorkItemSummary | Record<string, unknown>;

interface NormalizedItem {
  id: number;
  type: string;
  title: string;
  state: string;
  assignedTo?: string;
  priority?: number;
  tags: string[];
  createdDate?: string;
  changedDate?: string;
  areaPath?: string;
  iterationPath?: string;
  parentId?: number;
  description: string;
  acceptanceCriteria: string;
  attachments: string[];
  links: string[];
  raw: Record<string, unknown>;
}

export function outcomeRealizationCockpit(items: InputItem[], options: SteeringOptions = {}): Report & { writePerformed: false; outcomes: Array<Record<string, unknown>> } {
  const normalized = normalizeItems(items);
  const outcomes = normalized.map((item) => {
    const expected = expectedBenefit(item);
    const realized = firstNumber(item, REALIZED_FIELDS) ?? 0;
    const gap = Math.max(0, expected - realized);
    const status = realized >= expected * 0.8 ? "realized" : isClosed(item) ? "under-realized" : "pending";
    return {
      id: item.id,
      title: item.title,
      state: item.state,
      expectedBenefit: Math.round(expected),
      realizedBenefit: Math.round(realized),
      benefitGap: Math.round(gap),
      realizationStatus: status,
      evidenceSignals: evidenceSignals(item)
    };
  });
  const findings = outcomes
    .filter((entry) => entry.realizationStatus !== "realized")
    .map((entry) => finding(Number(entry.id), String(entry.title), Math.min(100, Number(entry.benefitGap) / 1000 + 30), [`expected ${entry.expectedBenefit}`, `realized ${entry.realizedBenefit}`, `status ${entry.realizationStatus}`], "Assign benefit owner and update realized benefit evidence."))
    .sort(byScoreDesc);
  return { ...report("Outcome Realization Cockpit", findings, `${outcomes.length} Work Items were assessed for expected versus realized outcome value.`, metricsFromOutcomes(outcomes)), writePerformed: false, outcomes };
}

export function aiBusinessCaseGenerator(items: InputItem[], options: SteeringOptions = {}): Report & { writePerformed: false; businessCases: Array<Record<string, unknown>> } {
  const cases = normalizeItems(items).map((item) => {
    const expected = expectedBenefit(item);
    const cost = implementationCost(item, options);
    const roi = cost > 0 ? Math.round(((expected - cost) / cost) * 100) : 0;
    const process = topProcessArea(item);
    const decision = expected >= cost * 2 ? "invest" : expected < cost ? "challenge" : "review";
    return {
      id: item.id,
      title: item.title,
      problem: item.description ? firstSentence(item.description) : "Problem statement missing from Description.",
      businessOutcome: process ? `${process.name} impact with ${Math.round(expected)} EUR expected annual benefit.` : `${Math.round(expected)} EUR expected annual benefit based on board signals.`,
      costAssumption: Math.round(cost),
      riskOfNotDoing: riskOfNotDoing(item, expected),
      roiPercent: roi,
      recommendation: decision
    };
  });
  const findings = cases.map((entry) => finding(Number(entry.id), String(entry.title), Math.abs(Number(entry.roiPercent)), [`cost ${entry.costAssumption}`, `ROI ${entry.roiPercent}%`, `recommendation ${entry.recommendation}`], "Review the generated business case with finance and the accountable process owner.")).sort(byScoreDesc);
  return { ...report("AI Business Case Generator", findings, `${cases.length} draft business case(s) generated from board evidence.`, { businessCases: cases.length }), writePerformed: false, businessCases: cases };
}

export function valueLeakageDetector(items: InputItem[], options: SteeringOptions = {}): Report & { writePerformed: false; leakage: Array<Record<string, unknown>> } {
  const asOf = referenceDate(items, options.asOfDate);
  const staleDays = positive(options.staleDays, 90);
  const leakage = normalizeItems(items).map((item) => {
    const stale = daysBetween(item.changedDate, asOf);
    let amount = 0;
    const signals: string[] = [];
    if (!isClosed(item) && stale >= staleDays) {
      amount += expectedBenefit(item) * 0.25;
      signals.push(`stale ${stale} days`);
    }
    if (!item.assignedTo && !isClosed(item)) {
      amount += expectedBenefit(item) * 0.1;
      signals.push("missing owner");
    }
    if (isClosed(item) && (firstNumber(item, REALIZED_FIELDS) ?? 0) === 0) {
      amount += expectedBenefit(item) * 0.2;
      signals.push("closed without realized benefit");
    }
    if (!evidenceSignals(item).length) {
      amount += implementationCost(item, options) * 0.25;
      signals.push("weak evidence");
    }
    return { id: item.id, title: item.title, estimatedLeakage: Math.round(amount), signals };
  }).filter((entry) => entry.signals.length);
  const findings = leakage.map((entry) => finding(entry.id, entry.title, Math.min(100, entry.estimatedLeakage / 1000), [`estimated leakage ${entry.estimatedLeakage}`, ...entry.signals], "Close, rework, assign owner, or capture benefit evidence to stop value leakage.")).sort(byScoreDesc);
  return { ...report("Value Leakage Detector", findings, `${leakage.length} value leakage candidate(s) detected.`, { estimatedLeakage: leakage.reduce((sum, entry) => sum + entry.estimatedLeakage, 0) }), writePerformed: false, leakage };
}

export function decisionTraceabilityGraph(items: InputItem[], evidence: Record<string, unknown>[] = []): Report & { writePerformed: false; graph: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> } } {
  const normalized = normalizeItems(items);
  const nodes: Array<Record<string, unknown>> = normalized.map((item) => ({ id: `wi:${item.id}`, kind: "workItem", label: `#${item.id} ${item.title}`, state: item.state }));
  const edges: Array<Record<string, unknown>> = [];
  for (const item of normalized) {
    if (item.parentId) edges.push({ from: `wi:${item.parentId}`, to: `wi:${item.id}`, relation: "parent-child" });
    for (const attachment of item.attachments) {
      nodes.push({ id: `attachment:${item.id}:${attachment}`, kind: "attachment", label: attachment });
      edges.push({ from: `wi:${item.id}`, to: `attachment:${item.id}:${attachment}`, relation: "has-evidence" });
    }
    if (DECISION_TERMS.test(`${item.title} ${item.description} ${item.state}`)) {
      nodes.push({ id: `decision:${item.id}`, kind: "decision", label: firstSentence(item.description || item.state) });
      edges.push({ from: `decision:${item.id}`, to: `wi:${item.id}`, relation: "decides" });
    }
  }
  for (const record of evidence) {
    const id = numberFrom(record.workItemId) ?? numberFrom(record.id);
    if (!id) continue;
    const label = firstSentence(stringFrom(record.text) || stringFrom(record.summary) || stringFrom(record.comment) || "Supplied evidence");
    nodes.push({ id: `evidence:${nodes.length}`, kind: "suppliedEvidence", label });
    edges.push({ from: `wi:${id}`, to: `evidence:${nodes.length - 1}`, relation: DECISION_TERMS.test(label) ? "decision-evidence" : "supporting-evidence" });
  }
  const missing = normalized.filter((item) => !nodes.some((node) => String(node.id).includes(`:${item.id}`) && node.kind !== "workItem"));
  const findings = missing.map((item) => finding(item.id, item.title, 65, ["no decision/evidence node linked"], "Add explicit decision, attachment, comment, or rationale evidence for traceability."));
  return { ...report("Decision Traceability Graph", findings, `${nodes.length} node(s) and ${edges.length} edge(s) generated for decision traceability.`, { nodes: nodes.length, edges: edges.length }), writePerformed: false, graph: { nodes, edges } };
}

export function erpProcessCriticalityModel(items: InputItem[], options: SteeringOptions = {}): Report & { writePerformed: false; criticality: Array<Record<string, unknown>> } {
  const criticality = normalizeItems(items).map((item) => {
    const area = topProcessArea(item);
    const score = Math.round(clamp((area ? 55 * area.multiplier : 20) + priorityWeight(item) + evidenceSignals(item).length * 5, 0, 100));
    return { id: item.id, title: item.title, processArea: area?.name || "Unclassified", criticalityScore: score, signals: [area ? `${area.name} keyword match` : "no process-area match", `priority ${priority(item)}`] };
  }).sort((a, b) => Number(b.criticalityScore) - Number(a.criticalityScore));
  const findings = criticality.map((entry) => finding(Number(entry.id), String(entry.title), Number(entry.criticalityScore), entry.signals as string[], "Validate process criticality with the accountable ERP process owner.")).sort(byScoreDesc);
  return { ...report("ERP Process Criticality Model", findings, `${criticality.length} item(s) scored against ERP process criticality.`, { assessedItems: criticality.length }), writePerformed: false, criticality };
}

export function automatedBoardDueDiligenceReport(items: InputItem[], evidence: Record<string, unknown>[] = [], options: SteeringOptions = {}): Report & { writePerformed: false; sections: Record<string, unknown> } {
  const outcome = outcomeRealizationCockpit(items, options);
  const leakage = valueLeakageDetector(items, options);
  const criticality = erpProcessCriticalityModel(items, options);
  const traceability = decisionTraceabilityGraph(items, evidence);
  const findings = [...leakage.findings.slice(0, 5), ...criticality.findings.slice(0, 5), ...traceability.findings.slice(0, 5)].sort(byScoreDesc).slice(0, 15);
  return {
    ...report("Automated Board Due Diligence Report", findings, "CIO due diligence combines outcome, value leakage, ERP criticality, and decision traceability evidence.", {
      assessedItems: normalizeItems(items).length,
      valueLeakageFindings: leakage.findings.length,
      criticalityFindings: criticality.findings.length,
      traceabilityGaps: traceability.findings.length
    }),
    writePerformed: false,
    sections: { outcome: outcome.metrics, leakage: leakage.metrics, criticality: criticality.metrics, traceability: traceability.metrics }
  };
}

export function requirementInvestDivestMatrix(items: InputItem[], options: SteeringOptions = {}): Report & { writePerformed: false; matrix: Array<Record<string, unknown>> } {
  const matrix = normalizeItems(items).map((item) => {
    const benefit = expectedBenefit(item);
    const cost = implementationCost(item, options);
    const quadrant = benefit >= cost * 2 && cost < 50_000 ? "invest" : benefit >= cost * 2 ? "steering-decision" : cost < 25_000 ? "bundle" : "divest";
    return { id: item.id, title: item.title, expectedBenefit: Math.round(benefit), estimatedCost: Math.round(cost), quadrant };
  });
  const findings = matrix.map((entry) => finding(Number(entry.id), String(entry.title), quadrantScore(String(entry.quadrant)), [`benefit ${entry.expectedBenefit}`, `cost ${entry.estimatedCost}`, `quadrant ${entry.quadrant}`], recommendationForQuadrant(String(entry.quadrant)))).sort(byScoreDesc);
  return { ...report("Requirement Invest/Divest Matrix", findings, `${matrix.length} Work Items placed into invest, steering-decision, bundle, or divest quadrants.`, countBy(matrix, "quadrant")), writePerformed: false, matrix };
}

export function changePortfolioSimulator(items: InputItem[], options: SteeringOptions & { closeIds?: number[]; removeIds?: number[] } = {}): Report & { writePerformed: false; simulation: Record<string, unknown> } {
  const normalized = normalizeItems(items);
  const removeIds = new Set([...(options.closeIds || []), ...(options.removeIds || [])]);
  const removed = normalized.filter((item) => removeIds.has(item.id));
  const remaining = normalized.filter((item) => !removeIds.has(item.id));
  const freedCost = removed.reduce((sum, item) => sum + implementationCost(item, options), 0);
  const lostBenefit = removed.reduce((sum, item) => sum + expectedBenefit(item), 0);
  const domainCoverage = PROCESS_AREAS.reduce<Record<string, number>>((acc, area) => {
    acc[area.name] = remaining.filter((item) => area.keywords.test(textFor(item))).length;
    return acc;
  }, {});
  const findings = removed.map((item) => finding(item.id, item.title, Math.min(100, implementationCost(item, options) / 1000), [`freed cost ${Math.round(implementationCost(item, options))}`, `lost benefit ${Math.round(expectedBenefit(item))}`], "Confirm that capacity gain outweighs lost benefit and process coverage.")).sort(byScoreDesc);
  return { ...report("Change Portfolio Simulator", findings, `${removed.length} simulated closure/removal item(s), ${Math.round(freedCost)} EUR capacity cost freed.`, { removedItems: removed.length, remainingItems: remaining.length, freedCost: Math.round(freedCost), lostBenefit: Math.round(lostBenefit) }), writePerformed: false, simulation: { removedIds: Array.from(removeIds), freedCost: Math.round(freedCost), lostBenefit: Math.round(lostBenefit), domainCoverage } };
}

export function aiSteeringCommitteePack(items: InputItem[], reports: Report[] = [], options: SteeringOptions = {}): Report & { writePerformed: false; markdown: string; html?: string } {
  const dueDiligence = automatedBoardDueDiligenceReport(items, [], options);
  const matrix = requirementInvestDivestMatrix(items, options);
  const sourceReports = [dueDiligence, matrix, ...reports];
  const findings = sourceReports.flatMap((source) => source.findings).sort(byScoreDesc).slice(0, 12);
  const generated = new Date().toISOString();
  const markdown = [
    "# AI Steering Committee Pack",
    "",
    `Generated: ${generated}`,
    "",
    "## Executive Decisions",
    ...findings.slice(0, 6).map((finding) => `- ${finding.id ? `#${finding.id} ` : ""}${finding.title}: ${finding.recommendation}`),
    "",
    "## Metrics",
    ...sourceReports.flatMap((source) => Object.entries(source.metrics || {}).map(([key, value]) => `- ${source.title}.${key}: ${value}`)),
    "",
    "_No Azure Boards write was performed._"
  ].join("\n");
  const result = { ...report("AI Steering Committee Pack", findings, `${findings.length} steering finding(s) prepared for executive review.`, { sourceReports: sourceReports.length }), writePerformed: false as const, markdown };
  return options.includeHtml ? { ...result, html: renderHtml(markdown) } : result;
}

export function policyAsCodeEvaluation(items: InputItem[], policy: Record<string, unknown> = {}, options: SteeringOptions = {}): Report & { writePerformed: false; controls: Array<Record<string, unknown>> } {
  const requiredTags = stringArray(policy.requiredTags);
  const requiredFields = stringArray(policy.requiredFields);
  const staleDays = positive(policy.staleDays, positive(options.staleDays, 90));
  const asOf = referenceDate(items, options.asOfDate);
  const controls = normalizeItems(items).flatMap((item) => {
    const rows: Array<Record<string, unknown>> = [];
    for (const tag of requiredTags) rows.push(control(item, `required-tag:${tag}`, item.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())));
    for (const field of requiredFields) rows.push(control(item, `required-field:${field}`, Boolean(valueForField(item, field))));
    rows.push(control(item, "owner-required-for-open-work", isClosed(item) || Boolean(item.assignedTo)));
    rows.push(control(item, `stale-under-${staleDays}-days`, isClosed(item) || daysBetween(item.changedDate, asOf) < staleDays));
    rows.push(control(item, "evidence-required", evidenceSignals(item).length > 0));
    return rows;
  });
  const failed = controls.filter((entry) => entry.status === "fail");
  const findings = failed.map((entry) => finding(Number(entry.id), String(entry.title), 75, [`control ${entry.control}`, `status ${entry.status}`], "Fix the failed policy-as-code control or document an explicit exception.")).sort(byScoreDesc);
  return { ...report("Policy-as-Code Evaluation", findings, `${controls.length} control evaluation(s) completed; ${failed.length} failed.`, { controls: controls.length, failedControls: failed.length }), writePerformed: false, controls };
}

function normalizeItems(items: InputItem[]): NormalizedItem[] {
  return items.map((raw, index) => {
    const record = objectFrom(raw);
    const fields = objectFrom(record.fields);
    const id = numberFrom(record.id) ?? numberFrom(fields["System.Id"]) ?? index + 1;
    return {
      id,
      type: stringFrom(record.type) || stringFrom(fields["System.WorkItemType"]) || "Work Item",
      title: stringFrom(record.title) || stringFrom(fields["System.Title"]) || `Work Item ${id}`,
      state: stringFrom(record.state) || stringFrom(fields["System.State"]) || "",
      assignedTo: identity(record.assignedTo) || identity(fields["System.AssignedTo"]),
      priority: numberFrom(record.priority) ?? numberFrom(fields["Microsoft.VSTS.Common.Priority"]),
      tags: tagsFrom(record.tags ?? fields["System.Tags"]),
      createdDate: stringFrom(record.createdDate) || stringFrom(fields["System.CreatedDate"]),
      changedDate: stringFrom(record.changedDate) || stringFrom(fields["System.ChangedDate"]),
      areaPath: stringFrom(record.areaPath) || stringFrom(fields["System.AreaPath"]),
      iterationPath: stringFrom(record.iterationPath) || stringFrom(fields["System.IterationPath"]),
      parentId: numberFrom(record.parentId) ?? parentIdFromRelations(record),
      description: stripHtml(stringFrom(record.description) || stringFrom(fields["System.Description"])),
      acceptanceCriteria: stripHtml(stringFrom(record.acceptanceCriteria) || stringFrom(fields["Microsoft.VSTS.Common.AcceptanceCriteria"])),
      attachments: attachmentNames(record),
      links: linkNames(record),
      raw: record
    };
  });
}

function expectedBenefit(item: NormalizedItem): number {
  return firstNumber(item, BENEFIT_FIELDS) ?? Math.max(10_000, valueScore(item) * 1_250 * (topProcessArea(item)?.multiplier || 1));
}

function implementationCost(item: NormalizedItem, options: SteeringOptions): number {
  const explicit = firstNumber(item, COST_FIELDS);
  if (explicit !== undefined) return explicit;
  const effort = firstNumber(item, EFFORT_FIELDS);
  if (effort !== undefined) return effort * 1_500;
  const base = positive(options.defaultItemCost, 12_000);
  if (/epic/i.test(item.type)) return base * 6;
  if (/feature/i.test(item.type)) return base * 3;
  if (/requirement|story|pbi/i.test(item.type)) return base * 1.5;
  return base;
}

function valueScore(item: NormalizedItem): number {
  const explicit = firstNumber(item, VALUE_FIELDS);
  const process = topProcessArea(item);
  const priorityPart = priorityWeight(item);
  const textBoost = /customer|kunde|revenue|umsatz|audit|compliance|automation|integration|schnittstelle/i.test(textFor(item)) ? 18 : 0;
  return Math.round(clamp((explicit ?? 0) * 8 + priorityPart + (process ? 25 * process.multiplier : 0) + textBoost, 0, 100));
}

function evidenceSignals(item: NormalizedItem): string[] {
  const signals: string[] = [];
  if (item.description.length >= 120) signals.push("description evidence");
  if (item.acceptanceCriteria.length >= 40) signals.push("acceptance criteria");
  if (item.attachments.length) signals.push(`${item.attachments.length} attachment(s)`);
  if (item.links.length) signals.push(`${item.links.length} linked artifact(s)`);
  if (item.tags.some((tag) => EVIDENCE_TERMS.test(tag))) signals.push("evidence tag");
  if (EVIDENCE_TERMS.test(item.description)) signals.push("evidence terms in description");
  return signals;
}

function topProcessArea(item: NormalizedItem): (typeof PROCESS_AREAS)[number] | undefined {
  return PROCESS_AREAS.filter((area) => area.keywords.test(textFor(item))).sort((a, b) => b.multiplier - a.multiplier)[0];
}

function control(item: NormalizedItem, name: string, passed: boolean): Record<string, unknown> {
  return { id: item.id, title: item.title, control: name, status: passed ? "pass" : "fail" };
}

function valueForField(item: NormalizedItem, field: string): unknown {
  const fields = objectFrom(item.raw.fields);
  if (field === "System.Description") return item.description;
  if (field === "Microsoft.VSTS.Common.AcceptanceCriteria") return item.acceptanceCriteria;
  return fields[field] ?? item.raw[field];
}

function riskOfNotDoing(item: NormalizedItem, expected: number): string {
  const process = topProcessArea(item)?.name || "business process";
  if (/regulatory|compliance|audit|gesetz|datenschutz|udi|gudid|eudamed/i.test(textFor(item))) return `Regulatory or audit exposure in ${process}; estimated annual value at risk ${Math.round(expected)} EUR.`;
  if (/customer|kunde|order|delivery|portal/i.test(textFor(item))) return `Customer or service impact in ${process}; estimated annual value at risk ${Math.round(expected)} EUR.`;
  return `Delayed process improvement in ${process}; estimated annual value at risk ${Math.round(expected)} EUR.`;
}

function metricsFromOutcomes(outcomes: Array<Record<string, unknown>>): Record<string, number> {
  return {
    assessedItems: outcomes.length,
    expectedBenefit: outcomes.reduce((sum, entry) => sum + Number(entry.expectedBenefit || 0), 0),
    realizedBenefit: outcomes.reduce((sum, entry) => sum + Number(entry.realizedBenefit || 0), 0),
    benefitGap: outcomes.reduce((sum, entry) => sum + Number(entry.benefitGap || 0), 0)
  };
}

function recommendationForQuadrant(quadrant: string): string {
  if (quadrant === "invest") return "Invest and protect delivery capacity.";
  if (quadrant === "steering-decision") return "Escalate for steering decision because benefit and cost are both material.";
  if (quadrant === "bundle") return "Bundle with related low-cost work or defer until capacity exists.";
  return "Divest, close, or rework before spending more capacity.";
}

function quadrantScore(quadrant: string): number {
  if (quadrant === "steering-decision") return 90;
  if (quadrant === "divest") return 80;
  if (quadrant === "invest") return 70;
  return 45;
}

function countBy(rows: Array<Record<string, unknown>>, key: string): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] || "unknown");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, { total: rows.length });
}

function report(title: string, findings: Finding[], summary: string, metrics: Record<string, number | string> = {}): Report {
  return {
    title,
    generatedAt: new Date().toISOString(),
    summary,
    findings,
    metrics: { findings: findings.length, ...metrics },
    nextActions: ["Use this as decision support only.", "Validate finance assumptions with process owners.", "Apply board writes only through explicit preview/apply tools."]
  };
}

function finding(id: number, title: string, score: number, signals: string[], recommendation: string): Finding {
  const bounded = Math.round(clamp(score, 0, 100));
  return { id, title: `#${id} ${title}`, score: bounded, severity: bounded >= 85 ? "critical" : bounded >= 65 ? "high" : bounded >= 35 ? "medium" : "low", signals, recommendation };
}

function referenceDate(items: InputItem[], override?: string): Date {
  const explicit = parseDate(override);
  if (explicit) return explicit;
  const times = normalizeItems(items).flatMap((item) => [parseDate(item.changedDate), parseDate(item.createdDate)]).filter((date): date is Date => Boolean(date)).map((date) => date.getTime());
  return times.length ? new Date(Math.max(...times)) : new Date();
}

function parentIdFromRelations(raw: Record<string, unknown>): number | undefined {
  const relations = Array.isArray(raw.relations) ? raw.relations as Record<string, unknown>[] : [];
  const relation = relations.find((entry) => entry.rel === "System.LinkTypes.Hierarchy-Reverse" || objectFrom(entry.attributes).name === "Parent");
  const match = stringFrom(relation?.url).match(/\/(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

function attachmentNames(raw: Record<string, unknown>): string[] {
  const relations = Array.isArray(raw.relations) ? raw.relations as Record<string, unknown>[] : [];
  return relations.filter((relation) => relation.rel === "AttachedFile").map((relation) => stringFrom(objectFrom(relation.attributes).name) || "attachment");
}

function linkNames(raw: Record<string, unknown>): string[] {
  const relations = Array.isArray(raw.relations) ? raw.relations as Record<string, unknown>[] : [];
  return relations.filter((relation) => relation.rel !== "AttachedFile" && relation.rel !== "System.LinkTypes.Hierarchy-Reverse").map((relation) => stringFrom(objectFrom(relation.attributes).name) || stringFrom(relation.rel) || "link");
}

function firstNumber(item: NormalizedItem, fields: string[]): number | undefined {
  const sourceFields = objectFrom(item.raw.fields);
  for (const field of fields) {
    const value = numberFrom(sourceFields[field]) ?? numberFrom(item.raw[field]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function priority(item: NormalizedItem): number {
  return item.priority && item.priority > 0 ? item.priority : 3;
}

function priorityWeight(item: NormalizedItem): number {
  return (6 - Math.min(priority(item), 5)) * 8;
}

function isClosed(item: NormalizedItem): boolean {
  return CLOSED_STATES.has(item.state.toLowerCase());
}

function daysBetween(value: string | undefined, asOf: Date): number {
  const date = parseDate(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((asOf.getTime() - date.getTime()) / 86_400_000));
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function textFor(item: NormalizedItem): string {
  return `${item.title} ${item.description} ${item.acceptanceCriteria} ${item.tags.join(" ")} ${item.areaPath || ""} ${item.iterationPath || ""}`.toLowerCase();
}

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberFrom(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function identity(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  const object = objectFrom(value);
  return stringFrom(object.displayName) || stringFrom(object.uniqueName) || undefined;
}

function tagsFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return stringFrom(value).split(";").map((entry) => entry.trim()).filter(Boolean);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function firstSentence(value: string): string {
  const stripped = stripHtml(value);
  const match = stripped.match(/^(.{1,220}?)(?:[.!?]\s|$)/);
  return (match ? match[1] : stripped.slice(0, 220)).trim();
}

function positive(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function byScoreDesc(a: Finding, b: Finding): number {
  return (b.score || 0) - (a.score || 0) || (a.id || 0) - (b.id || 0) || a.title.localeCompare(b.title);
}

function renderHtml(markdown: string): string {
  return `<!doctype html>\n<html><head><meta charset="utf-8"><title>AI Steering Committee Pack</title></head><body><pre>${markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre></body></html>`;
}
