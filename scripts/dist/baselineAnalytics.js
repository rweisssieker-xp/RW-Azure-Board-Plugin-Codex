const CLOSED_STATES = new Set(["closed", "done", "removed", "resolved", "completed"]);
const BLOCKER_WORDS = ["block", "blocked", "impediment", "waiting", "dependency", "on hold"];
const DEFAULT_THRESHOLDS = {
    openRatio: 0.1,
    staleRatio: 0.1,
    unassignedRatio: 0.08,
    blockerRatio: 0.05,
    governanceFindingsProxy: 0.1,
    throughputProxy: 0.1
};
export function createProcessBaseline(items, policy = {}) {
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
export function processDriftDetection(items, baseline, policy = {}) {
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
function calculateMetrics(items, policy, referenceDate) {
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
function normalizePolicy(policy) {
    return {
        staleDays: positiveNumber(policy.staleDays) || 10,
        requiredTags: stringArray(policy.requiredTags),
        allowedTypes: stringArray(policy.allowedTypes),
        driftThresholds: normalizeThresholds(policy.driftThresholds)
    };
}
function normalizeThresholds(input) {
    const thresholds = { ...DEFAULT_THRESHOLDS };
    if (!input)
        return thresholds;
    for (const metric of metricNames()) {
        thresholds[metric] = positiveNumber(input[metric]) ?? thresholds[metric];
    }
    return thresholds;
}
function driftMetric(metric, baseline, current, threshold) {
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
function governanceSignals(item, policy) {
    const signals = [];
    if (!item.title || item.title.length < 8)
        signals.push("title");
    if (!item.assignedTo && !isClosed(item))
        signals.push("assignee");
    const tags = (item.tags || []).map((tag) => tag.toLowerCase());
    for (const requiredTag of policy.requiredTags) {
        if (!tags.includes(requiredTag.toLowerCase()))
            signals.push(`tag:${requiredTag}`);
    }
    if (policy.allowedTypes.length && !policy.allowedTypes.includes(item.type))
        signals.push(`type:${item.type}`);
    return signals;
}
function metricNames() {
    return ["openRatio", "staleRatio", "unassignedRatio", "blockerRatio", "governanceFindingsProxy", "throughputProxy"];
}
function isClosed(item) {
    return CLOSED_STATES.has((item.state || "").toLowerCase());
}
function hasAny(item, words) {
    const haystack = `${item.title} ${(item.tags || []).join(" ")} ${item.type} ${item.state}`.toLowerCase();
    return words.some((word) => haystack.includes(word));
}
function latestItemDate(items) {
    const timestamps = items
        .flatMap((item) => [item.changedDate, item.createdDate])
        .map((value) => timestamp(value))
        .filter((value) => value !== undefined);
    if (!timestamps.length)
        return undefined;
    return new Date(Math.max(...timestamps)).toISOString();
}
function normalizeReferenceDate(value) {
    const parsed = timestamp(value);
    return parsed === undefined ? undefined : new Date(parsed).toISOString();
}
function daysBetween(start, end) {
    const startMs = timestamp(start);
    const endMs = timestamp(end);
    if (startMs === undefined || endMs === undefined || endMs <= startMs)
        return 0;
    return Math.floor((endMs - startMs) / 86_400_000);
}
function timestamp(value) {
    if (!value)
        return undefined;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : undefined;
}
function distribution(values) {
    return values
        .filter((value) => value.trim().length > 0)
        .sort(compareStrings)
        .reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
}
function compareStrings(left, right) {
    if (left < right)
        return -1;
    if (left > right)
        return 1;
    return 0;
}
function ratio(numerator, denominator) {
    return denominator > 0 ? round(numerator / denominator) : 0;
}
function round(value) {
    return Math.round(value * 1_000_000) / 1_000_000;
}
function positiveNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
function stringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean)
        : [];
}
