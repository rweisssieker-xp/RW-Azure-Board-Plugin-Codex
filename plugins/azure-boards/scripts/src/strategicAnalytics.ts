import type { Finding, Report, WorkItemSummary } from "./types.js";

const CLOSED_STATES = new Set(["closed", "done", "removed", "resolved", "completed"]);
const FIXED_GENERATED_AT = "1970-01-01T00:00:00.000Z";
const BLOCKER_WORDS = ["block", "blocked", "dependency", "waiting", "impediment", "on hold"];
const CUSTOMER_WORDS = ["customer", "client", "user", "production", "prod", "revenue", "contract"];
const RISK_WORDS = ["risk", "urgent", "escalate", "delay", "late", "outage", "security"];
const DEFECT_WORDS = ["bug", "defect", "incident", "regression", "hotfix"];

export interface CostOfDelayOptions {
  asOfDate?: string;
  horizonDays?: number;
  defaultDailyCost?: number;
  priorityDailyCosts?: Record<number, number>;
  customerImpactMultiplier?: number;
  blockerMultiplier?: number;
}

export interface ProcessSimulatorScenario {
  name?: string;
  throughputMultiplier?: number;
  capacityDelta?: number;
  cycleTimeReductionPercent?: number;
  wipLimit?: number;
  expeditedItemIds?: number[];
  addedScopeItems?: number;
  removedScopeItemIds?: number[];
  policyChange?: string;
}

export interface CapacityForecastOptions {
  asOfDate?: string;
  horizonDays?: number;
  lookbackDays?: number;
  teamCapacity?: number;
  focusFactor?: number;
  averageItemSize?: number;
}

interface ScoredItem {
  item: WorkItemSummary;
  score: number;
  delayCost: number;
  urgency: number;
  weightedSize: number;
  signals: string[];
}

export function costOfDelayRadar(items: WorkItemSummary[], options: CostOfDelayOptions = {}): Report {
  const asOf = referenceDate(items, options.asOfDate);
  const horizonDays = positiveNumber(options.horizonDays, 30);
  const scored = items
    .filter((item) => !isClosed(item))
    .map((item) => scoreCostOfDelay(item, asOf, horizonDays, options))
    .sort(byScoredItem)
    .slice(0, 12);

  const totalDelayCost = Math.round(scored.reduce((sum, entry) => sum + entry.delayCost, 0));
  const criticalCount = scored.filter((entry) => entry.score >= 80).length;
  const findings = scored.map((entry) =>
    findingForItem(
      entry.item,
      entry.score,
      [...entry.signals, `estimated ${horizonDays}-day delay cost ${Math.round(entry.delayCost)}`],
      entry.score >= 80
        ? "Make an explicit expedite, descope, or escalation decision for this item."
        : "Confirm business value and sequence against other high-delay-cost work."
    )
  );

  return report("Strategic Cost of Delay Radar", findings, asOf, {
    summary: `${findings.length} open Work Items ranked by estimated delay cost, urgency, and impact signals.`,
    metrics: {
      assessedItems: items.length,
      rankedOpenItems: findings.length,
      horizonDays,
      totalRankedDelayCost: totalDelayCost,
      criticalDelayItems: criticalCount
    },
    nextActions: [
      "Review the top cost-of-delay items with product and delivery owners.",
      "Decide which items deserve expedite treatment or scope tradeoffs.",
      "Validate the daily cost assumptions for high-severity findings."
    ]
  });
}

export function processSimulator(items: WorkItemSummary[], scenario: ProcessSimulatorScenario): Report {
  const asOf = referenceDate(items);
  const openItems = items.filter((item) => !isClosed(item) && !scenario.removedScopeItemIds?.includes(item.id));
  const baselineThroughput = recentThroughput(items, asOf, 30);
  const baselineCapacity = Math.max(0.1, baselineThroughput);
  const throughputMultiplier = positiveNumber(scenario.throughputMultiplier, 1);
  const adjustedCapacity = Math.max(0.1, baselineCapacity * throughputMultiplier + positiveNumber(scenario.capacityDelta, 0));
  const cycleTimeFactor = Math.max(0.1, 1 - clamp(positiveNumber(scenario.cycleTimeReductionPercent, 0), 0, 90) / 100);
  const addedScopeItems = Math.max(0, Math.round(positiveNumber(scenario.addedScopeItems, 0)));
  const baselineWork = totalWeightedSize(items.filter((item) => !isClosed(item)));
  const scenarioWork = totalWeightedSize(openItems) + addedScopeItems * averageWeightedSize(openItems);
  const baselineDays = Math.ceil(baselineWork / baselineCapacity);
  const simulatedDays = Math.ceil((scenarioWork / adjustedCapacity) * cycleTimeFactor);
  const deltaDays = simulatedDays - baselineDays;
  const wipPressure = scenario.wipLimit && openItems.length > scenario.wipLimit ? openItems.length - scenario.wipLimit : 0;
  const expeditedItems = openItems.filter((item) => scenario.expeditedItemIds?.includes(item.id));

  const findings: Finding[] = [
    {
      title: `${scenario.name || "Scenario"} changes forecast by ${signed(deltaDays)} days`,
      score: scoreFromDelta(deltaDays, wipPressure),
      severity: severityFromDelta(deltaDays, wipPressure),
      signals: [
        `baseline forecast ${baselineDays} days`,
        `scenario forecast ${simulatedDays} days`,
        `capacity ${round(adjustedCapacity)} items/day`,
        `scope size ${round(scenarioWork)} weighted items`
      ],
      recommendation: deltaDays > 0
        ? "Reduce added scope, increase capacity, or defer lower-value work before committing this scenario."
        : "Use the scenario as a candidate plan, then validate assumptions against team availability and dependencies."
    }
  ];

  if (wipPressure > 0) {
    findings.push({
      title: `WIP limit would be exceeded by ${wipPressure} items`,
      score: Math.min(100, 50 + wipPressure * 10),
      severity: wipPressure > 5 ? "high" : "medium",
      signals: [`${openItems.length} open items`, `WIP limit ${scenario.wipLimit}`],
      recommendation: "Sequence work explicitly or raise the limit only with matching capacity."
    });
  }

  for (const item of expeditedItems.slice(0, 5)) {
    findings.push(findingForItem(item, 70, ["marked for expedite in scenario"], "Check whether expedite cost is justified by delay cost and customer impact."));
  }

  return report("What-if Process Simulator", findings.sort(byScoreDesc), asOf, {
    summary: `Scenario "${scenario.name || "unnamed"}" compares baseline delivery duration with adjusted capacity, scope, and cycle-time assumptions.`,
    metrics: {
      baselineDays,
      simulatedDays,
      deltaDays,
      baselineThroughput: round(baselineThroughput),
      adjustedCapacity: round(adjustedCapacity),
      openItems: openItems.length,
      addedScopeItems,
      expeditedItems: expeditedItems.length
    },
    nextActions: [
      "Validate the scenario assumptions with team leads before using them for commitments.",
      "Compare this result with a no-new-scope scenario.",
      "Inspect WIP and expedite findings before changing the plan."
    ]
  });
}

export function capacityForecast(items: WorkItemSummary[], options: CapacityForecastOptions = {}): Report {
  const asOf = referenceDate(items, options.asOfDate);
  const horizonDays = positiveNumber(options.horizonDays, 30);
  const lookbackDays = positiveNumber(options.lookbackDays, 30);
  const throughput = positiveNumber(options.teamCapacity, recentThroughput(items, asOf, lookbackDays));
  const focusFactor = clamp(positiveNumber(options.focusFactor, 0.8), 0.1, 1);
  const averageItemSize = positiveNumber(options.averageItemSize, averageWeightedSize(items));
  const effectiveCapacity = throughput * focusFactor;
  const forecastCapacity = Math.floor((effectiveCapacity * horizonDays) / averageItemSize);
  const openItems = items.filter((item) => !isClosed(item));
  const highPriorityOpen = openItems.filter((item) => priority(item) <= 2);
  const requiredCapacity = Math.ceil(totalWeightedSize(openItems) / averageItemSize);
  const capacityGap = forecastCapacity - requiredCapacity;
  const utilization = requiredCapacity > 0 ? Math.round((requiredCapacity / Math.max(forecastCapacity, 1)) * 100) : 0;

  const findings: Finding[] = [
    {
      title: capacityGap >= 0 ? `Capacity surplus of ${capacityGap} items` : `Capacity gap of ${Math.abs(capacityGap)} items`,
      score: capacityGap >= 0 ? Math.max(10, 60 - capacityGap * 5) : Math.min(100, 60 + Math.abs(capacityGap) * 8),
      severity: capacityGap < -5 ? "high" : capacityGap < 0 ? "medium" : "low",
      signals: [
        `${forecastCapacity} forecast items in ${horizonDays} days`,
        `${requiredCapacity} weighted open items`,
        `${round(effectiveCapacity)} effective items/day`,
        `${utilization}% forecast utilization`
      ],
      recommendation: capacityGap < 0
        ? "Reduce committed scope, increase available capacity, or split work before promising the full backlog."
        : "Reserve surplus capacity for defects, dependency churn, and unplanned urgent work."
    }
  ];

  if (highPriorityOpen.length > forecastCapacity) {
    findings.push({
      title: "High-priority demand exceeds forecast capacity",
      score: Math.min(100, 70 + (highPriorityOpen.length - forecastCapacity) * 5),
      severity: "high",
      signals: [`${highPriorityOpen.length} high-priority open items`, `${forecastCapacity} forecast capacity items`],
      recommendation: "Force-rank high-priority work and make lower-value commitments explicit tradeoffs."
    });
  }

  return report("Strategic Capacity Forecast", findings.sort(byScoreDesc), asOf, {
    summary: `Forecast estimates deliverable item capacity over ${horizonDays} days from deterministic throughput and sizing assumptions.`,
    metrics: {
      assessedItems: items.length,
      openItems: openItems.length,
      horizonDays,
      lookbackDays,
      throughput: round(throughput),
      focusFactor: round(focusFactor),
      forecastCapacity,
      requiredCapacity,
      capacityGap,
      utilization
    },
    nextActions: [
      "Confirm team availability and focus factor for the forecast period.",
      "Reconcile high-priority demand against forecast capacity.",
      "Use the capacity gap to drive scope, staffing, or date decisions."
    ]
  });
}

function scoreCostOfDelay(item: WorkItemSummary, asOf: Date, horizonDays: number, options: CostOfDelayOptions): ScoredItem {
  const age = daysBetween(item.createdDate, asOf);
  const stale = daysBetween(item.changedDate, asOf);
  const itemPriority = priority(item);
  const dailyCost = options.priorityDailyCosts?.[itemPriority] || positiveNumber(options.defaultDailyCost, 100) * (6 - Math.min(itemPriority, 5));
  const customerMultiplier = hasAny(item, CUSTOMER_WORDS) ? positiveNumber(options.customerImpactMultiplier, 1.5) : 1;
  const blockerMultiplier = hasAny(item, BLOCKER_WORDS) ? positiveNumber(options.blockerMultiplier, 1.35) : 1;
  const riskMultiplier = hasAny(item, RISK_WORDS) ? 1.25 : 1;
  const delayCost = dailyCost * horizonDays * customerMultiplier * blockerMultiplier * riskMultiplier;
  const urgency = clamp((6 - Math.min(itemPriority, 5)) * 12 + age + stale * 1.5, 0, 100);
  const score = Math.round(clamp(urgency * 0.55 + Math.min(100, delayCost / 50) * 0.45, 0, 100));
  const signals = [`priority ${itemPriority}`, `age ${age} days`, `stale ${stale} days`];
  if (customerMultiplier > 1) signals.push("customer/revenue impact language");
  if (blockerMultiplier > 1) signals.push("blocker/dependency language");
  if (riskMultiplier > 1) signals.push("risk/escalation language");
  return { item, score, delayCost, urgency, weightedSize: weightedSize(item), signals };
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

function findingForItem(item: WorkItemSummary, score: number, signals: string[], recommendation: string): Finding {
  return {
    id: item.id,
    title: `#${item.id} ${item.title || "(untitled)"}`,
    score,
    severity: score > 80 ? "critical" : score > 60 ? "high" : score > 30 ? "medium" : "low",
    signals,
    recommendation
  };
}

function referenceDate(items: WorkItemSummary[], override?: string): Date {
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

function recentThroughput(items: WorkItemSummary[], asOf: Date, lookbackDays: number): number {
  const closedInWindow = items.filter((item) => {
    if (!isClosed(item)) return false;
    const changed = parseDate(item.changedDate);
    return Boolean(changed) && daysBetween(changed?.toISOString(), asOf) <= lookbackDays;
  });
  const fallbackClosed = items.filter(isClosed).length;
  const completed = closedInWindow.length || Math.min(fallbackClosed, Math.max(1, Math.round(items.length * 0.15)));
  return Math.max(0.1, completed / Math.max(lookbackDays, 1));
}

function totalWeightedSize(items: WorkItemSummary[]): number {
  return items.reduce((sum, item) => sum + weightedSize(item), 0);
}

function averageWeightedSize(items: WorkItemSummary[]): number {
  return items.length ? totalWeightedSize(items) / items.length : 1;
}

function weightedSize(item: WorkItemSummary): number {
  let size = 1;
  const type = item.type.toLowerCase();
  if (type.includes("epic")) size += 5;
  else if (type.includes("feature")) size += 3;
  else if (type.includes("story") || type.includes("requirement") || type.includes("pbi")) size += 1;
  if (hasAny(item, DEFECT_WORDS)) size += 0.5;
  if (hasAny(item, BLOCKER_WORDS)) size += 0.75;
  if (item.tags.length > 4) size += 0.25;
  return size;
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

function priority(item: WorkItemSummary): number {
  return item.priority && Number.isFinite(item.priority) && item.priority > 0 ? item.priority : 3;
}

function isClosed(item: WorkItemSummary): boolean {
  return CLOSED_STATES.has((item.state || "").toLowerCase());
}

function hasAny(item: WorkItemSummary, words: string[]): boolean {
  const haystack = `${item.title} ${item.tags.join(" ")} ${item.type} ${item.state} ${item.severity || ""}`.toLowerCase();
  return words.some((word) => haystack.includes(word));
}

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function scoreFromDelta(deltaDays: number, wipPressure: number): number {
  return Math.round(clamp(50 + deltaDays * 3 + wipPressure * 5, 0, 100));
}

function severityFromDelta(deltaDays: number, wipPressure: number): Finding["severity"] {
  if (deltaDays > 10 || wipPressure > 5) return "high";
  if (deltaDays > 0 || wipPressure > 0) return "medium";
  return "low";
}

function byScoredItem(a: ScoredItem, b: ScoredItem): number {
  return b.score - a.score || b.delayCost - a.delayCost || b.urgency - a.urgency || b.weightedSize - a.weightedSize || a.item.id - b.item.id;
}

function byScoreDesc(a: Finding, b: Finding): number {
  return (b.score || 0) - (a.score || 0) || (a.id || 0) - (b.id || 0) || a.title.localeCompare(b.title);
}
