import type { WorkItemSummary } from "./types.js";

const CLOSED_STATES = new Set(["closed", "done", "removed", "resolved", "completed"]);
const BLOCKER_WORDS = ["block", "blocked", "impediment", "waiting", "dependency", "on hold"];

export interface ProcessBaselinePolicy {
  asOf?: string;
  staleDays?: number;
  requiredTags?: string[];
  allowedTypes?: string[];
  driftThresholds?: Partial<Record<ProcessMetricName, number>>;
}

export type ProcessMetricName =
  | "openRatio"
  | "staleRatio"
  | "unassignedRatio"
  | "blockerRatio"
  | "governanceFindingsProxy"
  | "throughputProxy";

export interface ProcessBaselineMetrics {
  totalItems: number;
  openItems: number;
  closedItems: number;
  staleOpenItems: number;
  unassignedOpenItems: number;
  blockerItems: number;
  governanceFindingItems: number;
  openRatio: number;
  staleRatio: number;
  unassignedRatio: number;
  blockerRatio: number;
  governanceFindingsProxy: number;
  throughputProxy: number;
}

export interface ProcessBaseline {
  kind: "azureBoards.processBaseline";
  version: 1;
  referenceDate: string;
  policy: Required<Omit<ProcessBaselinePolicy, "asOf" | "driftThresholds">> & {
    driftThresholds: Record<ProcessMetricName, number>;
  };
  metrics: ProcessBaselineMetrics;
  stateDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
}

export interface ProcessDriftMetric {
  metric: ProcessMetricName;
  baseline: number;
  current: number;
  delta: number;
  relativeDelta: number;
  threshold: number;
  drifted: boolean;
  direction: "up" | "down" | "flat";
}

export interface ProcessDriftDetection {
  kind: "azureBoards.processDriftDetection";
  version: 1;
  referenceDate: string;
  baselineReferenceDate: string;
  drifted: boolean;
  summary: string;
  metrics: ProcessDriftMetric[];
  current: ProcessBaseline;
  baseline: ProcessBaseline;
}

const DEFAULT_THRESHOLDS: Record<ProcessMetricName, number> = {
  openRatio: 0.1,
  staleRatio: 0.1,
  unassignedRatio: 0.08,
  blockerRatio: 0.05,
  governanceFindingsProxy: 0.1,
  throughputProxy: 0.1
};

export function createProcessBaseline(items: WorkItemSummary[], policy: ProcessBaselinePolicy = {}): ProcessBaseline {
  const effectivePolicy = normalizePolicy(policy);
  const referenceDate = normalizeReferenceDate(policy.asOf) || latestItemDate(items) || "1970-01-01T00:00:00.000Z";
  return {
    kind: "azureBoards.processBaseline",
    version: 1,
    referenceDate,
    policy: effectivePolicy,
    metrics: calculateMetrics(items, effectivePolicy, referenceDate),
    stateDistribution: distribution(items.map((item) => item.state || "Unknown")),
    typeDistribution: distribution(items.map((item) => item.type || "Unknown")),
    tagDistribution: distribution(items.flatMap((item) => item.tags || []))
  };
}

export function processDriftDetection(
  items: WorkItemSummary[],
  baseline: ProcessBaseline,
  policy: ProcessBaselinePolicy = {}
): ProcessDriftDetection {
  const current = createProcessBaseline(items, {
    ...baseline.policy,
    ...policy,
    driftThresholds: { ...baseline.policy.driftThresholds, ...policy.driftThresholds }
  });
  const thresholds = current.policy.driftThresholds;
  const metrics = metricNames().map((metric) => driftMetric(metric, baseline.metrics[metric], current.metrics[metric], thresholds[metric]));
  const driftedMetrics = metrics.filter((metric) => metric.drifted);
  return {
    kind: "azureBoards.processDriftDetection",
    version: 1,
    referenceDate: current.referenceDate,
    baselineReferenceDate: baseline.referenceDate,
    drifted: driftedMetrics.length > 0,
    summary: driftedMetrics.length
      ? `${driftedMetrics.length} process metrics drifted beyond threshold: ${driftedMetrics.map((metric) => metric.metric).join(", ")}.`
      : "No process metrics drifted beyond configured thresholds.",
    metrics,
    current,
    baseline
  };
}

function calculateMetrics(items: WorkItemSummary[], policy: ProcessBaseline["policy"], referenceDate: string): ProcessBaselineMetrics {
  const open = items.filter((item) => !isClosed(item));
  const closedItems = items.length - open.length;
  const stale = open.filter((item) => daysBetween(item.changedDate || item.createdDate, referenceDate) > policy.staleDays);
  const unassigned = open.filter((item) => !item.assignedTo);
  const blocked = items.filter((item) => hasAny(item, BLOCKER_WORDS));
  const governanceFindings = items.filter((item) => governanceSignals(item, policy).length > 0);

  return {
    totalItems: items.length,
    openItems: open.length,
    closedItems,
    staleOpenItems: stale.length,
    unassignedOpenItems: unassigned.length,
    blockerItems: blocked.length,
    governanceFindingItems: governanceFindings.length,
    openRatio: ratio(open.length, items.length),
    staleRatio: ratio(stale.length, open.length),
    unassignedRatio: ratio(unassigned.length, open.length),
    blockerRatio: ratio(blocked.length, items.length),
    governanceFindingsProxy: ratio(governanceFindings.length, items.length),
    throughputProxy: ratio(closedItems, items.length)
  };
}

function normalizePolicy(policy: ProcessBaselinePolicy): ProcessBaseline["policy"] {
  return {
    staleDays: positiveNumber(policy.staleDays) || 10,
    requiredTags: stringArray(policy.requiredTags),
    allowedTypes: stringArray(policy.allowedTypes),
    driftThresholds: normalizeThresholds(policy.driftThresholds)
  };
}

function normalizeThresholds(input: ProcessBaselinePolicy["driftThresholds"]): Record<ProcessMetricName, number> {
  const thresholds = { ...DEFAULT_THRESHOLDS };
  if (!input) return thresholds;
  for (const metric of metricNames()) {
    thresholds[metric] = positiveNumber(input[metric]) ?? thresholds[metric];
  }
  return thresholds;
}

function driftMetric(metric: ProcessMetricName, baseline: number, current: number, threshold: number): ProcessDriftMetric {
  const delta = round(current - baseline);
  return {
    metric,
    baseline,
    current,
    delta,
    relativeDelta: baseline === 0 ? (current === 0 ? 0 : 1) : round(delta / baseline),
    threshold,
    drifted: Math.abs(delta) > threshold,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  };
}

function governanceSignals(item: WorkItemSummary, policy: ProcessBaseline["policy"]): string[] {
  const signals: string[] = [];
  if (!item.title || item.title.length < 8) signals.push("title");
  if (!item.assignedTo && !isClosed(item)) signals.push("assignee");
  const tags = (item.tags || []).map((tag) => tag.toLowerCase());
  for (const requiredTag of policy.requiredTags) {
    if (!tags.includes(requiredTag.toLowerCase())) signals.push(`tag:${requiredTag}`);
  }
  if (policy.allowedTypes.length && !policy.allowedTypes.includes(item.type)) signals.push(`type:${item.type}`);
  return signals;
}

function metricNames(): ProcessMetricName[] {
  return ["openRatio", "staleRatio", "unassignedRatio", "blockerRatio", "governanceFindingsProxy", "throughputProxy"];
}

function isClosed(item: WorkItemSummary): boolean {
  return CLOSED_STATES.has((item.state || "").toLowerCase());
}

function hasAny(item: WorkItemSummary, words: string[]): boolean {
  const haystack = `${item.title} ${(item.tags || []).join(" ")} ${item.type} ${item.state}`.toLowerCase();
  return words.some((word) => haystack.includes(word));
}

function latestItemDate(items: WorkItemSummary[]): string | undefined {
  const timestamps = items
    .flatMap((item) => [item.changedDate, item.createdDate])
    .map((value) => timestamp(value))
    .filter((value): value is number => value !== undefined);
  if (!timestamps.length) return undefined;
  return new Date(Math.max(...timestamps)).toISOString();
}

function normalizeReferenceDate(value?: string): string | undefined {
  const parsed = timestamp(value);
  return parsed === undefined ? undefined : new Date(parsed).toISOString();
}

function daysBetween(start: string | undefined, end: string): number {
  const startMs = timestamp(start);
  const endMs = timestamp(end);
  if (startMs === undefined || endMs === undefined || endMs <= startMs) return 0;
  return Math.floor((endMs - startMs) / 86_400_000);
}

function timestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function distribution(values: string[]): Record<string, number> {
  return values
    .filter((value) => value.trim().length > 0)
    .sort(compareStrings)
    .reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? round(numerator / denominator) : 0;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}
