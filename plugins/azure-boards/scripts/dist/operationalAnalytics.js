const CLOSED_STATES = new Set(["closed", "done", "removed", "resolved", "completed"]);
const DEFAULT_BLOCKED_KEYWORDS = ["block", "blocked", "impediment", "waiting", "dependency", "on hold"];
const DEFAULT_DECISION_KEYWORDS = ["decision", "decide", "approval", "sign-off", "clarify", "open question"];
const DEFAULT_CUSTOMER_KEYWORDS = ["customer", "client", "user", "production", "prod", "outage", "impact"];
const DAY_MS = 86_400_000;
const DEFAULT_POLICY = {
    slaDays: 14,
    staleDays: 10,
    blockedDays: 3,
    highPriorityThreshold: 2,
    maxItems: 20,
    maxActions: 12,
    requiredTags: [],
    blockedKeywords: DEFAULT_BLOCKED_KEYWORDS,
    decisionKeywords: DEFAULT_DECISION_KEYWORDS,
    customerKeywords: DEFAULT_CUSTOMER_KEYWORDS,
    defaultOwner: undefined,
    staleTag: "Needs update",
    blockedTag: "Blocked",
    escalationTag: "Escalate",
    evidenceTag: "Needs evidence"
};
export function watchlistReport(items, optionsOrPolicy = {}) {
    const { policy, options } = normalizeInputs(optionsOrPolicy);
    const asOf = resolveAsOfDate(items, options.asOfDate);
    const evaluated = items
        .filter((item) => !isClosed(item))
        .map((item) => evaluateItem(item, policy, asOf))
        .filter((entry) => entry.score > 0)
        .sort(byOperationalPriority)
        .slice(0, options.maxItems ?? policy.maxItems);
    const critical = evaluated.filter((entry) => entry.severity === "critical").length;
    const high = evaluated.filter((entry) => entry.severity === "high").length;
    const open = items.filter((item) => !isClosed(item)).length;
    return {
        title: "Proactive Process Watchdog",
        generatedAt: asOf.toISOString(),
        writePerformed: false,
        summary: `${evaluated.length} watchlist items need operational attention; ${critical} critical and ${high} high severity.`,
        metrics: {
            assessedItems: items.length,
            openItems: open,
            watchlistItems: evaluated.length,
            criticalItems: critical,
            highItems: high,
            averageScore: averageScore(evaluated)
        },
        watchlist: evaluated
    };
}
export function actionPlan(items, policyInput = {}, options = {}) {
    const policy = normalizePolicy(policyInput);
    const asOf = resolveAsOfDate(items, options.asOfDate);
    const watchlist = items
        .filter((item) => !isClosed(item))
        .map((item) => evaluateItem(item, policy, asOf))
        .filter((entry) => entry.score > 0)
        .sort(byOperationalPriority);
    const actions = watchlist
        .map((entry) => buildAction(entry, items, policy))
        .sort((left, right) => left.priorityRank - right.priorityRank || right.score - left.score || left.id - right.id)
        .slice(0, options.maxActions ?? policy.maxActions)
        .map((action, index) => ({ ...action, priorityRank: index + 1 }));
    const withPatches = actions.filter((item) => item.patchPreview.length > 0).length;
    return {
        title: "AI Action Plan",
        generatedAt: asOf.toISOString(),
        writePerformed: false,
        summary: `${actions.length} prioritized no-write actions generated; ${withPatches} include JSON Patch previews for review.`,
        metrics: {
            assessedItems: items.length,
            candidateItems: watchlist.length,
            plannedActions: actions.length,
            actionsWithPatchPreview: withPatches,
            averageScore: averageScore(actions)
        },
        actions
    };
}
function normalizeInputs(input) {
    return {
        policy: normalizePolicy(input),
        options: {
            asOfDate: stringValue(input.asOfDate),
            maxItems: positiveNumber(input.maxItems),
            maxActions: positiveNumber(input.maxActions)
        }
    };
}
function normalizePolicy(input = {}) {
    return {
        ...DEFAULT_POLICY,
        slaDays: positiveNumber(input.slaDays) ?? DEFAULT_POLICY.slaDays,
        staleDays: positiveNumber(input.staleDays) ?? DEFAULT_POLICY.staleDays,
        blockedDays: positiveNumber(input.blockedDays) ?? DEFAULT_POLICY.blockedDays,
        highPriorityThreshold: positiveNumber(input.highPriorityThreshold) ?? DEFAULT_POLICY.highPriorityThreshold,
        maxItems: positiveNumber(input.maxItems) ?? DEFAULT_POLICY.maxItems,
        maxActions: positiveNumber(input.maxActions) ?? DEFAULT_POLICY.maxActions,
        requiredTags: normalizeStrings(input.requiredTags),
        blockedKeywords: normalizeStrings(input.blockedKeywords, DEFAULT_BLOCKED_KEYWORDS),
        decisionKeywords: normalizeStrings(input.decisionKeywords, DEFAULT_DECISION_KEYWORDS),
        customerKeywords: normalizeStrings(input.customerKeywords, DEFAULT_CUSTOMER_KEYWORDS),
        defaultOwner: stringValue(input.defaultOwner),
        staleTag: stringValue(input.staleTag) ?? DEFAULT_POLICY.staleTag,
        blockedTag: stringValue(input.blockedTag) ?? DEFAULT_POLICY.blockedTag,
        escalationTag: stringValue(input.escalationTag) ?? DEFAULT_POLICY.escalationTag,
        evidenceTag: stringValue(input.evidenceTag) ?? DEFAULT_POLICY.evidenceTag
    };
}
function evaluateItem(item, policy, asOf) {
    const ageDays = daysBetween(item.createdDate, asOf);
    const staleDays = daysBetween(item.changedDate, asOf);
    const signals = [];
    let score = 0;
    if (!item.assignedTo) {
        score += 20;
        signals.push("open item has no assignee");
    }
    if (staleDays > policy.staleDays) {
        score += Math.min(30, 10 + staleDays - policy.staleDays);
        signals.push(`no update for ${staleDays} days`);
    }
    if (ageDays > policy.slaDays) {
        score += Math.min(30, 10 + ageDays - policy.slaDays);
        signals.push(`age ${ageDays} days exceeds SLA ${policy.slaDays}`);
    }
    if ((item.priority ?? 99) <= policy.highPriorityThreshold) {
        score += 15;
        signals.push(`priority ${item.priority} is at or above threshold ${policy.highPriorityThreshold}`);
    }
    if (includesAny(item, policy.blockedKeywords)) {
        score += staleDays > policy.blockedDays ? 30 : 20;
        signals.push("blocker or dependency language detected");
    }
    if (includesAny(item, policy.decisionKeywords)) {
        score += 12;
        signals.push("decision or approval language detected");
    }
    if (includesAny(item, policy.customerKeywords)) {
        score += 15;
        signals.push("customer or production impact language detected");
    }
    const missingTags = missingRequiredTags(item, policy.requiredTags);
    if (missingTags.length > 0) {
        score += Math.min(20, missingTags.length * 8);
        signals.push(`missing required tags: ${missingTags.join(", ")}`);
    }
    const boundedScore = Math.min(100, score);
    return {
        id: item.id,
        title: item.title || "(untitled)",
        type: item.type || "Work Item",
        state: item.state || "Unknown",
        assignedTo: item.assignedTo,
        priority: item.priority,
        severity: severityForScore(boundedScore),
        score: boundedScore,
        ageDays,
        staleDays,
        evidenceSignals: signals,
        recommendedAction: recommendationFor(signals, boundedScore)
    };
}
function buildAction(entry, items, policy) {
    const item = items.find((candidate) => candidate.id === entry.id);
    const signals = entry.evidenceSignals;
    const actionType = actionTypeFor(signals);
    const patchPreview = item ? patchFor(item, actionType, policy) : [];
    return {
        id: entry.id,
        title: entry.title,
        priorityRank: 0,
        severity: entry.severity,
        score: entry.score,
        actionType,
        action: actionFor(actionType, entry),
        rationale: entry.recommendedAction,
        evidenceSignals: signals,
        patchPreview,
        writePerformed: false
    };
}
function patchFor(item, actionType, policy) {
    const patches = [];
    const tags = new Set(item.tags.map((tag) => tag.trim()).filter(Boolean));
    for (const tag of missingRequiredTags(item, policy.requiredTags)) {
        tags.add(tag);
    }
    if (!item.assignedTo && policy.defaultOwner) {
        patches.push({ op: "add", path: "/fields/System.AssignedTo", value: policy.defaultOwner });
    }
    if (actionType === "unblock") {
        tags.add(policy.blockedTag);
        tags.add(policy.escalationTag);
    }
    if (actionType === "refresh-stale-work" || actionType === "escalate-sla") {
        tags.add(policy.staleTag);
    }
    if (actionType === "add-evidence") {
        tags.add(policy.evidenceTag);
    }
    const nextTags = Array.from(tags).sort((left, right) => left.localeCompare(right));
    if (nextTags.join("; ") !== item.tags.slice().sort((left, right) => left.localeCompare(right)).join("; ")) {
        patches.push({ op: "add", path: "/fields/System.Tags", value: nextTags.join("; ") });
    }
    return patches;
}
function actionTypeFor(signals) {
    if (signals.some((signal) => signal.includes("no assignee")))
        return "assign-owner";
    if (signals.some((signal) => signal.includes("blocker") || signal.includes("dependency")))
        return "unblock";
    if (signals.some((signal) => signal.includes("exceeds SLA")))
        return "escalate-sla";
    if (signals.some((signal) => signal.includes("no update")))
        return "refresh-stale-work";
    if (signals.some((signal) => signal.includes("missing required tags")))
        return "complete-policy-fields";
    return "add-evidence";
}
function actionFor(actionType, entry) {
    switch (actionType) {
        case "assign-owner":
            return `Assign a named owner for #${entry.id} and request the next dated update.`;
        case "unblock":
            return `Escalate blocker resolution for #${entry.id} and capture the dependency owner.`;
        case "escalate-sla":
            return `Review SLA breach for #${entry.id} and decide whether to close, defer, or explicitly exempt it.`;
        case "refresh-stale-work":
            return `Refresh #${entry.id} with current status, next step, and target date.`;
        case "complete-policy-fields":
            return `Complete required process metadata for #${entry.id}.`;
        case "add-evidence":
            return `Attach evidence for #${entry.id} so the team can verify the current state.`;
    }
}
function recommendationFor(signals, score) {
    if (signals.some((signal) => signal.includes("blocker") || signal.includes("dependency"))) {
        return "Escalate dependency ownership, unblock path, and record a dated follow-up.";
    }
    if (signals.some((signal) => signal.includes("no assignee"))) {
        return "Assign a directly accountable owner before the next operational review.";
    }
    if (signals.some((signal) => signal.includes("exceeds SLA"))) {
        return "Decide whether to close, replan, or exempt the SLA breach with evidence.";
    }
    if (signals.some((signal) => signal.includes("no update"))) {
        return "Request a status update with the next action and target date.";
    }
    if (score >= 60)
        return "Review in the next delivery checkpoint and record the decision.";
    return "Monitor for drift and add evidence if the signal is confirmed.";
}
function resolveAsOfDate(items, explicit) {
    const explicitDate = parseDate(explicit);
    if (explicitDate)
        return explicitDate;
    const timestamps = items
        .flatMap((item) => [parseDate(item.createdDate), parseDate(item.changedDate)])
        .filter((date) => Boolean(date))
        .map((date) => date.getTime());
    return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date(0);
}
function daysBetween(value, asOf) {
    const date = parseDate(value);
    if (!date)
        return 0;
    const delta = asOf.getTime() - date.getTime();
    return Number.isFinite(delta) && delta > 0 ? Math.floor(delta / DAY_MS) : 0;
}
function parseDate(value) {
    if (!value)
        return undefined;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : undefined;
}
function isClosed(item) {
    return CLOSED_STATES.has((item.state || "").toLowerCase());
}
function includesAny(item, words) {
    const haystack = `${item.title} ${item.tags.join(" ")} ${item.type} ${item.state}`.toLowerCase();
    return words.some((word) => haystack.includes(word.toLowerCase()));
}
function missingRequiredTags(item, requiredTags) {
    const existing = new Set(item.tags.map((tag) => tag.toLowerCase()));
    return requiredTags.filter((tag) => !existing.has(tag.toLowerCase()));
}
function severityForScore(score) {
    if (score >= 85)
        return "critical";
    if (score >= 65)
        return "high";
    if (score >= 35)
        return "medium";
    return "low";
}
function byOperationalPriority(left, right) {
    return right.score - left.score || (left.priority ?? 99) - (right.priority ?? 99) || left.id - right.id;
}
function averageScore(items) {
    if (items.length === 0)
        return 0;
    return Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
}
function normalizeStrings(value, fallback = []) {
    const source = value && value.length > 0 ? value : fallback;
    return Array.from(new Set(source.map((item) => item.trim()).filter(Boolean)));
}
function positiveNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
function stringValue(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
