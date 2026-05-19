import type { Finding, Report, WorkItem, WorkItemSummary } from "./types.js";

const CLOSED_STATES = new Set(["closed", "done", "removed", "resolved", "completed", "inactive"]);
const REMOVED_STATES = new Set(["removed", "cut", "cancelled", "canceled", "rejected"]);
const FIXED_GENERATED_AT = "1970-01-01T00:00:00.000Z";

const VALUE_FIELDS = ["Custom.BusinessValue", "Microsoft.VSTS.Common.BusinessValue", "BusinessValue", "Business Value"] as const;
const TARGET_BENEFIT_FIELDS = ["Custom.TargetBenefit", "Custom.ExpectedBenefit", "Custom.AnnualBenefit", "Custom.Benefit", "Business.TargetBenefit"] as const;
const REALIZED_BENEFIT_FIELDS = ["Custom.RealizedBenefit", "Custom.ActualBenefit", "Custom.BenefitRealized", "Business.RealizedBenefit"] as const;
const COST_FIELDS = ["Custom.Cost", "Custom.EstimatedCost", "Custom.Budget", "Microsoft.VSTS.Scheduling.OriginalEstimate", "Microsoft.VSTS.Scheduling.RemainingWork"] as const;
const EFFORT_FIELDS = ["Custom.JobDuration", "Custom.Effort", "Microsoft.VSTS.Scheduling.Effort", "Microsoft.VSTS.Scheduling.StoryPoints", "Microsoft.VSTS.Scheduling.Size"] as const;

const ERP_DOMAINS: Array<{ name: string; keywords: RegExp; weight: number }> = [
  { name: "Finance", keywords: /rechnung|faktura|invoice|payment|paypal|ledger|debitor|kreditor|konto|preis|price|cost|umsatz|revenue|tax|vat|buchung/i, weight: 1.25 },
  { name: "Production", keywords: /produktion|fertigung|bde|kanban|material|charge|arbeitsplan|shopfloor|manufacturing|warehouse|lager|kommission|packraum/i, weight: 1.2 },
  { name: "Compliance", keywords: /compliance|audit|gesetz|validierung|validation|datenschutz|gdpr|e-rechnung|udi|gudid|eudamed|zoll|customs|tüv/i, weight: 1.3 },
  { name: "Integration", keywords: /schnittstelle|interface|integration|api|export|import|ssis|webservice|xml|csv|datalake|wup|addone/i, weight: 1.15 },
  { name: "Customer", keywords: /kunde|customer|client|crm|portal|shop|service|liefer|delivery|contract|sla/i, weight: 1.1 },
  { name: "Master Data", keywords: /stammdaten|master data|artikel|item master|supplier|vendor|address|adresse|metadata|mapping/i, weight: 1.05 },
  { name: "Automation", keywords: /automat|workflow|job|batch|massendaten|manual|manuell|robot|scheduler/i, weight: 1.05 }
];

export interface PortfolioRationalizationOptions {
  asOfDate?: string;
  staleDays?: number;
  highValueThreshold?: number;
  lowValueThreshold?: number;
  maxFindings?: number;
}

export interface BenefitRealizationOptions {
  asOfDate?: string;
  realizationLagDays?: number;
  minimumTargetBenefit?: number;
  maxFindings?: number;
}

export interface CostAvoidanceOptions {
  asOfDate?: string;
  defaultItemCost?: number;
  defaultStoryPointCost?: number;
  maxFindings?: number;
}

export interface ErpDomainImpactOptions {
  asOfDate?: string;
  maxFindings?: number;
}

type RationalizationDecision = "keep" | "kill" | "merge" | "rework";

interface NormalizedItem {
  id: number;
  type: string;
  title: string;
  state: string;
  priority?: number;
  severity?: string;
  tags: string[];
  createdDate?: string;
  changedDate?: string;
  areaPath?: string;
  iterationPath?: string;
  parentId?: number;
  description: string;
  raw: Record<string, unknown>;
}

interface DomainScore {
  domain: string;
  score: number;
  signals: string[];
}

export function portfolioRationalization(
  items: Array<WorkItem | WorkItemSummary | Record<string, unknown>>,
  options: PortfolioRationalizationOptions = {}
): Report {
  const normalized = normalizeItems(items);
  const asOf = referenceDate(normalized, options.asOfDate);
  const staleDays = positiveNumber(options.staleDays, 120);
  const highValueThreshold = positiveNumber(options.highValueThreshold, 65);
  const lowValueThreshold = positiveNumber(options.lowValueThreshold, 28);
  const duplicateGroups = duplicateTitleGroups(normalized);

  const findings = normalized
    .filter((item) => !isClosed(item))
    .map((item) => {
      const value = valueScore(item);
      const evidence = evidenceScore(item);
      const effort = effortScore(item);
      const stale = daysBetween(item.changedDate, asOf);
      const duplicateIds = duplicateGroups.get(titleKey(item.title))?.filter((id) => id !== item.id) || [];
      const domain = topDomain(item);
      const decision = rationalizationDecision(value, evidence, effort, stale, staleDays, duplicateIds.length, highValueThreshold, lowValueThreshold);
      const score = rationalizationScore(decision, value, evidence, effort, stale, staleDays, duplicateIds.length);
      const signals = [`decision ${decision}`, `value score ${value}`, `evidence score ${evidence}`, `effort score ${effort}`, `stale ${stale} days`];
      if (domain) signals.push(`${domain.domain} impact ${domain.score}`);
      if (duplicateIds.length) signals.push(`possible duplicate/merge with ${duplicateIds.map((id) => `#${id}`).join(", ")}`);
      return findingForItem(item, score, signals, recommendationForDecision(decision));
    })
    .sort(byScoreDesc)
    .slice(0, maxItems(options.maxFindings, 20));

  const decisionCounts = countDecisions(findings);
  return report("Portfolio Rationalization", findings, asOf, {
    summary: `${findings.length} open portfolio item(s) classified for keep, kill, merge, or rework decisions.`,
    metrics: {
      assessedItems: normalized.length,
      openItems: normalized.filter((item) => !isClosed(item)).length,
      keep: decisionCounts.keep,
      kill: decisionCounts.kill,
      merge: decisionCounts.merge,
      rework: decisionCounts.rework,
      staleDays
    },
    nextActions: [
      "Confirm every kill, merge, or rework decision with the accountable business owner.",
      "Merge duplicate items before estimating or committing capacity.",
      "Keep high-value items only when evidence and domain impact are explicit."
    ]
  });
}

export function benefitRealizationTracking(
  items: Array<WorkItem | WorkItemSummary | Record<string, unknown>>,
  options: BenefitRealizationOptions = {}
): Report {
  const normalized = normalizeItems(items);
  const asOf = referenceDate(normalized, options.asOfDate);
  const realizationLagDays = positiveNumber(options.realizationLagDays, 30);
  const minimumTargetBenefit = positiveNumber(options.minimumTargetBenefit, 10_000);
  const tracked = normalized
    .map((item) => benefitEntry(item, asOf, realizationLagDays, minimumTargetBenefit))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const findings = tracked
    .map((entry) => findingForItem(entry.item, entry.score, entry.signals, entry.recommendation))
    .sort(byScoreDesc)
    .slice(0, maxItems(options.maxFindings, 20));
  const targetBenefit = tracked.reduce((sum, entry) => sum + entry.targetBenefit, 0);
  const realizedBenefit = tracked.reduce((sum, entry) => sum + entry.realizedBenefit, 0);
  const realizationRate = targetBenefit > 0 ? Math.round((realizedBenefit / targetBenefit) * 100) : 0;

  return report("Benefit Realization Tracking", findings, asOf, {
    summary: `${tracked.length} item(s) have explicit or inferred benefit targets requiring realization tracking.`,
    metrics: {
      assessedItems: normalized.length,
      trackedItems: tracked.length,
      targetBenefit: Math.round(targetBenefit),
      realizedBenefit: Math.round(realizedBenefit),
      realizationRate,
      realizationLagDays
    },
    nextActions: [
      "Assign benefit owners to high-target items with missing actuals.",
      "Re-baseline targets whose actual benefit is persistently below plan.",
      "Close the loop by recording realized benefit on completed portfolio work."
    ]
  });
}

export function costAvoidanceByClosure(
  items: Array<WorkItem | WorkItemSummary | Record<string, unknown>>,
  options: CostAvoidanceOptions = {}
): Report {
  const normalized = normalizeItems(items);
  const asOf = referenceDate(normalized, options.asOfDate);
  const defaultItemCost = positiveNumber(options.defaultItemCost, 8_000);
  const defaultStoryPointCost = positiveNumber(options.defaultStoryPointCost, 1_500);
  const findings = normalized
    .filter((item) => isClosed(item) || hasAny(item, [/descope|de-scope|descoped|scope cut|nicht umsetzen|not implement|won.t do/i]))
    .map((item) => {
      const effort = rawEffort(item);
      const explicitCost = firstNumber(item, COST_FIELDS);
      const avoidedCost = Math.round(explicitCost ?? (effort ? effort * defaultStoryPointCost : defaultItemCost * typeCostMultiplier(item)));
      const removed = REMOVED_STATES.has(item.state.toLowerCase()) || hasAny(item, [/descope|de-scope|descoped|scope cut|won.t do/i]);
      const value = valueScore(item);
      const score = Math.round(clamp((avoidedCost / defaultItemCost) * 35 + (removed ? 25 : 10) + Math.max(0, 40 - value), 0, 100));
      const signals = [
        `avoided cost ${avoidedCost}`,
        explicitCost ? "explicit cost field" : effort ? `effort ${effort}` : "default item cost assumption",
        removed ? "closed/de-scoped demand" : `terminal state ${item.state}`,
        `value score ${value}`
      ];
      return findingForItem(item, score, signals, "Record the avoided spend rationale and verify that no downstream dependent work remains open.");
    })
    .sort(byScoreDesc)
    .slice(0, maxItems(options.maxFindings, 20));
  const totalAvoidedCost = findings.reduce((sum, finding) => sum + numberFromSignal(finding.signals, "avoided cost "), 0);

  return report("Cost Avoidance by Closing or De-scoping", findings, asOf, {
    summary: `${findings.length} closed or de-scoped item(s) translated into deterministic cost-avoidance estimates.`,
    metrics: {
      assessedItems: normalized.length,
      avoidedItems: findings.length,
      totalAvoidedCost: Math.round(totalAvoidedCost),
      defaultItemCost,
      defaultStoryPointCost
    },
    nextActions: [
      "Review avoided-cost assumptions with finance before using them externally.",
      "Check whether closed parent items still have open children.",
      "Capture repeated de-scope themes as portfolio guardrails."
    ]
  });
}

export function erpDomainImpactScoring(
  items: Array<WorkItem | WorkItemSummary | Record<string, unknown>>,
  options: ErpDomainImpactOptions = {}
): Report {
  const normalized = normalizeItems(items);
  const asOf = referenceDate(normalized, options.asOfDate);
  const findings = normalized
    .map((item) => {
      const domains = domainScores(item);
      const top = domains[0];
      const value = valueScore(item);
      const score = Math.round(clamp((top?.score || 12) * 0.65 + value * 0.35, 0, 100));
      const signals = [...(top ? [`primary domain ${top.domain}`, ...top.signals] : ["no strong ERP domain keyword match"]), `value score ${value}`, `priority ${priority(item)}`];
      if (domains.length > 1) signals.push(`cross-domain: ${domains.slice(0, 4).map((domain) => domain.domain).join(", ")}`);
      return findingForItem(item, score, signals, "Use ERP domain impact to sequence portfolio work with business process owners and integration owners.");
    })
    .sort(byScoreDesc)
    .slice(0, maxItems(options.maxFindings, 20));
  const domainCounts = ERP_DOMAINS.reduce<Record<string, number>>((counts, domain) => {
    counts[domain.name] = normalized.filter((item) => domain.keywords.test(textFor(item))).length;
    return counts;
  }, {});

  return report("ERP Domain Impact Scoring", findings, asOf, {
    summary: `${normalized.length} item(s) scored for ERP process-domain impact using deterministic keyword, priority, and value signals.`,
    metrics: {
      assessedItems: normalized.length,
      ...domainCounts
    },
    nextActions: [
      "Review high cross-domain scores for dependency and change-management risk.",
      "Ask domain owners to validate the primary impact classification.",
      "Use low-domain-impact items as candidates for bundling or parking."
    ]
  });
}

export const costAvoidanceAnalysis = costAvoidanceByClosure;

function normalizeItems(items: Array<WorkItem | WorkItemSummary | Record<string, unknown>>): NormalizedItem[] {
  return items.map((raw, index) => {
    const record = objectFrom(raw);
    const fields = objectFrom(record.fields);
    const id = numberFrom(record.id) ?? numberFrom(fields["System.Id"]) ?? index + 1;
    return {
      id,
      type: stringFrom(record.type) || stringFrom(fields["System.WorkItemType"]) || "Work Item",
      title: stringFrom(record.title) || stringFrom(fields["System.Title"]) || `Work Item ${id}`,
      state: stringFrom(record.state) || stringFrom(fields["System.State"]) || "",
      priority: numberFrom(record.priority) ?? numberFrom(fields["Microsoft.VSTS.Common.Priority"]),
      severity: stringFrom(record.severity) || stringFrom(fields["Microsoft.VSTS.Common.Severity"]),
      tags: tagsFrom(record.tags ?? fields["System.Tags"]),
      createdDate: stringFrom(record.createdDate) || stringFrom(fields["System.CreatedDate"]),
      changedDate: stringFrom(record.changedDate) || stringFrom(fields["System.ChangedDate"]),
      areaPath: stringFrom(record.areaPath) || stringFrom(fields["System.AreaPath"]),
      iterationPath: stringFrom(record.iterationPath) || stringFrom(fields["System.IterationPath"]),
      parentId: numberFrom(record.parentId) ?? parentIdFromRelations(record),
      description: stripHtml(stringFrom(fields["System.Description"]) || stringFrom(fields["Microsoft.VSTS.Common.AcceptanceCriteria"]) || stringFrom(record.description)),
      raw: record
    };
  });
}

function valueScore(item: NormalizedItem): number {
  const explicit = firstNumber(item, VALUE_FIELDS);
  const priorityScore = (6 - Math.min(priority(item), 5)) * 10;
  const domain = topDomain(item)?.score || 0;
  const benefit = Math.min(100, (firstNumber(item, TARGET_BENEFIT_FIELDS) || 0) / 2_000);
  const keywordBoost = hasAny(item, [/revenue|umsatz|customer|kunde|compliance|audit|risk|automation|automat|saving|cost/i]) ? 12 : 0;
  return Math.round(clamp((explicit !== undefined ? explicit * 10 : 0) + priorityScore + domain * 0.25 + benefit * 0.4 + keywordBoost, 0, 100));
}

function evidenceScore(item: NormalizedItem): number {
  let score = 0;
  if (item.description.length >= 120) score += 25;
  if (item.description.length >= 400) score += 15;
  if (firstNumber(item, TARGET_BENEFIT_FIELDS) !== undefined) score += 25;
  if (firstNumber(item, VALUE_FIELDS) !== undefined) score += 15;
  if (item.tags.length) score += 10;
  if (item.areaPath) score += 10;
  return Math.min(100, score);
}

function effortScore(item: NormalizedItem): number {
  const effort = rawEffort(item);
  const typeBoost = /epic/i.test(item.type) ? 45 : /feature/i.test(item.type) ? 30 : /requirement|story|pbi/i.test(item.type) ? 18 : 10;
  return Math.round(clamp((effort || 0) * 8 + typeBoost, 0, 100));
}

function rawEffort(item: NormalizedItem): number | undefined {
  return firstNumber(item, EFFORT_FIELDS);
}

function rationalizationDecision(
  value: number,
  evidence: number,
  effort: number,
  stale: number,
  staleDays: number,
  duplicateCount: number,
  highValueThreshold: number,
  lowValueThreshold: number
): RationalizationDecision {
  if (duplicateCount > 0) return "merge";
  if (value >= highValueThreshold && evidence >= 35) return "keep";
  if (value <= lowValueThreshold && stale >= staleDays) return "kill";
  if (value >= highValueThreshold && (evidence < 35 || effort > 75)) return "rework";
  if (evidence < 25 || effort > value + 30) return "rework";
  return value >= 45 ? "keep" : "kill";
}

function rationalizationScore(decision: RationalizationDecision, value: number, evidence: number, effort: number, stale: number, staleDays: number, duplicates: number): number {
  if (decision === "keep") return Math.round(clamp(value * 0.7 + evidence * 0.3, 0, 100));
  if (decision === "merge") return Math.round(clamp(65 + duplicates * 15 + Math.min(20, value / 5), 0, 100));
  if (decision === "kill") return Math.round(clamp(45 + Math.max(0, stale - staleDays) / 3 + Math.max(0, 40 - value), 0, 100));
  return Math.round(clamp(40 + Math.max(0, 60 - evidence) + Math.max(0, effort - value) * 0.5, 0, 100));
}

function benefitEntry(item: NormalizedItem, asOf: Date, realizationLagDays: number, minimumTargetBenefit: number): {
  item: NormalizedItem;
  score: number;
  targetBenefit: number;
  realizedBenefit: number;
  signals: string[];
  recommendation: string;
} | undefined {
  const targetBenefit = firstNumber(item, TARGET_BENEFIT_FIELDS) ?? inferredBenefit(item);
  if (targetBenefit < minimumTargetBenefit) return undefined;
  const realizedBenefit = firstNumber(item, REALIZED_BENEFIT_FIELDS) ?? 0;
  const completionAge = isClosed(item) ? daysBetween(item.changedDate, asOf) : 0;
  const gap = Math.max(0, targetBenefit - realizedBenefit);
  const rate = targetBenefit > 0 ? Math.round((realizedBenefit / targetBenefit) * 100) : 0;
  const missingAfterLag = isClosed(item) && completionAge >= realizationLagDays && realizedBenefit === 0;
  const score = Math.round(clamp((gap / Math.max(targetBenefit, 1)) * 70 + (missingAfterLag ? 30 : 0) + (isClosed(item) ? 10 : 20), 0, 100));
  const signals = [
    `target benefit ${Math.round(targetBenefit)}`,
    `realized benefit ${Math.round(realizedBenefit)}`,
    `realization rate ${rate}%`,
    isClosed(item) ? `completed ${completionAge} days ago` : `state ${item.state}`
  ];
  if (missingAfterLag) signals.push(`missing realized benefit after ${realizationLagDays}-day lag`);
  return {
    item,
    score,
    targetBenefit,
    realizedBenefit,
    signals,
    recommendation: missingAfterLag || gap > targetBenefit * 0.35
      ? "Assign a benefit owner and update actual benefit evidence or re-baseline the business case."
      : "Keep monitoring until actual benefit is stable enough for portfolio reporting."
  };
}

function inferredBenefit(item: NormalizedItem): number {
  const base = valueScore(item) * 1_000;
  const domainMultiplier = (topDomain(item)?.score || 30) >= 70 ? 1.5 : 1;
  return Math.round(base * domainMultiplier);
}

function domainScores(item: NormalizedItem): DomainScore[] {
  const text = textFor(item);
  return ERP_DOMAINS
    .map((domain) => {
      if (!domain.keywords.test(text)) return undefined;
      const value = firstNumber(item, VALUE_FIELDS);
      const score = Math.round(clamp((45 + (value ?? priority(item)) * 5 + (item.description.length > 160 ? 10 : 0)) * domain.weight, 0, 100));
      const signals = [`${domain.name.toLowerCase()} keyword match`, item.areaPath ? `area ${item.areaPath}` : `type ${item.type}`];
      return { domain: domain.name, score, signals };
    })
    .filter((score): score is DomainScore => Boolean(score))
    .sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
}

function topDomain(item: NormalizedItem): DomainScore | undefined {
  return domainScores(item)[0];
}

function duplicateTitleGroups(items: NormalizedItem[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const item of items) {
    const key = titleKey(item.title);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), item.id]);
  }
  for (const [key, ids] of groups) {
    if (ids.length < 2) groups.delete(key);
  }
  return groups;
}

function titleKey(title: string): string {
  return title.toLowerCase().replace(/[#\d]/g, "").replace(/\b(the|a|an|for|to|in|with|and|und|der|die|das)\b/g, " ").replace(/\s+/g, " ").trim();
}

function countDecisions(findings: Finding[]): Record<RationalizationDecision, number> {
  const counts = { keep: 0, kill: 0, merge: 0, rework: 0 };
  for (const finding of findings) {
    const signal = finding.signals.find((entry) => entry.startsWith("decision "));
    const decision = signal?.replace("decision ", "") as RationalizationDecision | undefined;
    if (decision && decision in counts) counts[decision] += 1;
  }
  return counts;
}

function recommendationForDecision(decision: RationalizationDecision): string {
  if (decision === "keep") return "Keep in the portfolio, confirm owner, and protect capacity if evidence remains current.";
  if (decision === "kill") return "Review for closure or parking; avoid further spend unless a stronger business case is added.";
  if (decision === "merge") return "Consolidate duplicate demand under one accountable parent before prioritization.";
  return "Rework the business case, benefit evidence, effort estimate, or scope before a keep/kill decision.";
}

function report(title: string, findings: Finding[], asOf: Date, options: Partial<Report> = {}): Report {
  return {
    title,
    generatedAt: asOf.toISOString(),
    summary: options.summary || `${findings.length} findings generated.`,
    findings,
    metrics: options.metrics,
    nextActions: options.nextActions
  };
}

function findingForItem(item: NormalizedItem, score: number, signals: string[], recommendation: string): Finding {
  return {
    id: item.id,
    title: `#${item.id} ${item.title || "(untitled)"}`,
    score,
    severity: score >= 85 ? "critical" : score >= 65 ? "high" : score >= 35 ? "medium" : "low",
    signals,
    recommendation
  };
}

function referenceDate(items: NormalizedItem[], override?: string): Date {
  const overrideDate = parseDate(override);
  if (overrideDate) return overrideDate;
  const maxTime = Math.max(
    ...items
      .flatMap((item) => [parseDate(item.changedDate), parseDate(item.createdDate)])
      .filter((date): date is Date => Boolean(date))
      .map((date) => date.getTime())
  );
  return Number.isFinite(maxTime) ? new Date(maxTime) : new Date(FIXED_GENERATED_AT);
}

function daysBetween(value: string | undefined, asOf: Date): number {
  const date = parseDate(value);
  if (!date) return 0;
  const ms = asOf.getTime() - date.getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function firstNumber(item: NormalizedItem, fields: readonly string[]): number | undefined {
  const sourceFields = objectFrom(item.raw.fields);
  for (const field of fields) {
    const value = numberFrom(sourceFields[field]) ?? numberFrom(item.raw[field]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function parentIdFromRelations(raw: Record<string, unknown>): number | undefined {
  const relations = Array.isArray(raw.relations) ? raw.relations as Record<string, unknown>[] : [];
  const relation = relations.find((entry) => entry.rel === "System.LinkTypes.Hierarchy-Reverse" || objectFrom(entry.attributes).name === "Parent");
  const match = stringFrom(relation?.url).match(/\/(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

function isClosed(item: NormalizedItem): boolean {
  return CLOSED_STATES.has(item.state.toLowerCase());
}

function typeCostMultiplier(item: NormalizedItem): number {
  if (/epic/i.test(item.type)) return 6;
  if (/feature/i.test(item.type)) return 3;
  if (/requirement|story|pbi/i.test(item.type)) return 1.5;
  return 1;
}

function hasAny(item: NormalizedItem, patterns: RegExp[]): boolean {
  const text = textFor(item);
  return patterns.some((pattern) => pattern.test(text));
}

function textFor(item: NormalizedItem): string {
  return `${item.title} ${item.description} ${item.type} ${item.state} ${item.tags.join(" ")} ${item.areaPath || ""} ${item.iterationPath || ""}`.toLowerCase();
}

function tagsFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(";").map((entry) => entry.trim()).filter(Boolean);
  return [];
}

function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberFrom(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function numberFromSignal(signals: string[], prefix: string): number {
  const signal = signals.find((entry) => entry.startsWith(prefix));
  return numberFrom(signal?.slice(prefix.length)) ?? 0;
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function priority(item: NormalizedItem): number {
  return item.priority && Number.isFinite(item.priority) && item.priority > 0 ? item.priority : 3;
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function maxItems(value: unknown, fallback: number): number {
  return Math.max(1, Math.min(100, Math.trunc(positiveNumber(value, fallback))));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function byScoreDesc(a: Finding, b: Finding): number {
  return (b.score || 0) - (a.score || 0) || (a.id || 0) - (b.id || 0) || a.title.localeCompare(b.title);
}
