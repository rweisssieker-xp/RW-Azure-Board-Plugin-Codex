import { toSummary } from "./azureDevOps.js";
const TERMINAL_STATES = new Set(["closed", "done", "completed", "removed", "inactive"]);
const REQUIREMENT_TYPES = new Set(["requirement", "user story", "feature", "epic", "product backlog item"]);
const RISK_TERMS = [
    "audit",
    "compliance",
    "datenschutz",
    "deadline",
    "e-rechnung",
    "eudamed",
    "gudid",
    "gesetz",
    "security",
    "udi"
];
const VALUE_TERMS = [
    "automation",
    "automatisiert",
    "customer",
    "finance",
    "integration",
    "kunde",
    "production",
    "rechnung",
    "schnittstelle",
    "umsatz"
];
const EVIDENCE_FIELDS = [
    "System.Description",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
    "Microsoft.VSTS.CMMI.RequirementType",
    "Custom.BusinessJustification",
    "Custom.DecisionRationale"
];
export function requirementDecisionCockpit(items, options = {}) {
    const normalized = requirementItems(items);
    const minEvidenceScore = numberFrom(options.minEvidenceScore) ?? 45;
    const decisions = normalized
        .map((item) => decisionFor(item, minEvidenceScore))
        .sort((a, b) => b.score - a.score || a.id - b.id);
    const findings = decisions
        .filter((decision) => decision.decision !== "review")
        .map((decision) => ({
        id: decision.id,
        title: decision.title,
        score: decision.score,
        severity: decision.decision === "accelerate" ? "high" : decision.decision === "close" ? "medium" : "low",
        signals: decision.rationale,
        recommendation: recommendationForDecision(decision.decision)
    }));
    return {
        ...report("Requirement Decision Cockpit", findings, `${decisions.length} requirement decision(s) scored. No writes were performed.`, {
            accelerate: decisions.filter((decision) => decision.decision === "accelerate").length,
            review: decisions.filter((decision) => decision.decision === "review").length,
            park: decisions.filter((decision) => decision.decision === "park").length,
            close: decisions.filter((decision) => decision.decision === "close").length
        }),
        writePerformed: false,
        decisions
    };
}
export function evidenceFirstRequirementReview(items, evidence = []) {
    const evidenceById = evidenceMap(evidence);
    const reviews = requirementItems(items)
        .map((item) => evidenceReviewFor(item, evidenceById.get(item.id) || []))
        .sort((a, b) => a.evidenceScore - b.evidenceScore || a.id - b.id);
    const findings = reviews
        .filter((review) => review.evidenceScore < 70)
        .map((review) => ({
        id: review.id,
        title: review.title,
        score: 100 - review.evidenceScore,
        severity: review.evidenceScore < 35 ? "high" : "medium",
        signals: [...review.evidenceSignals, ...review.missingEvidence.map((missing) => `missing: ${missing}`)],
        recommendation: review.recommendation
    }));
    return {
        ...report("Evidence-First Requirement Review", findings, `${findings.length} requirement(s) need stronger decision evidence.`, {
            reviewed: reviews.length,
            weakEvidence: findings.length
        }),
        writePerformed: false,
        reviews
    };
}
export function cioRequirementRiskView(items, options = {}) {
    const staleDays = numberFrom(options.staleDays) ?? 60;
    const riskItems = requirementItems(items)
        .map((item) => cioRiskFor(item, staleDays))
        .filter((item) => item.riskScore > 0)
        .sort((a, b) => b.riskScore - a.riskScore || a.id - b.id);
    const findings = riskItems.map((item) => ({
        id: item.id,
        title: item.title,
        score: item.riskScore,
        severity: item.severity,
        signals: item.exposure,
        recommendation: "Assign a named owner, confirm decision evidence, and time-box the next executive review."
    }));
    return {
        ...report("CIO Requirement Risk View", findings, `${riskItems.length} requirement(s) carry CIO-visible delivery, compliance, or ownership risk.`, {
            critical: riskItems.filter((item) => item.severity === "critical").length,
            high: riskItems.filter((item) => item.severity === "high").length,
            medium: riskItems.filter((item) => item.severity === "medium").length
        }),
        writePerformed: false,
        riskItems
    };
}
function decisionFor(item, minEvidenceScore) {
    const evidence = evidenceScore(item, []);
    const value = keywordScore(item, VALUE_TERMS, 15);
    const risk = keywordScore(item, RISK_TERMS, 20);
    const priorityScore = item.priority === undefined ? 0 : Math.max(0, 25 - item.priority * 5);
    const stale = daysSince(item.changedDate);
    const stalePenalty = stale >= 120 ? 35 : stale >= 60 ? 20 : 0;
    const terminalPenalty = isTerminal(item.state) ? 40 : 0;
    const score = clamp(evidence + value + risk + priorityScore - stalePenalty - terminalPenalty, 0, 100);
    const rationale = [
        `evidence ${evidence}`,
        `value signal ${value}`,
        `risk signal ${risk}`,
        `priority ${item.priority ?? "n/a"}`,
        stale ? `changed ${stale} days ago` : "no changed date"
    ];
    let decision = "review";
    if (isTerminal(item.state))
        decision = "close";
    else if (evidence < minEvidenceScore)
        decision = stale >= 120 ? "park" : "review";
    else if (score >= 75)
        decision = "accelerate";
    else if (score < 35 && stale >= 90)
        decision = "park";
    return { id: item.id, title: item.title, state: item.state, decision, score, rationale };
}
function evidenceReviewFor(item, suppliedEvidence) {
    const score = evidenceScore(item, suppliedEvidence);
    const missing = [];
    if (item.description.length < 160)
        missing.push("clear problem statement");
    if (item.acceptanceCriteria.length < 80)
        missing.push("acceptance criteria");
    if (!attachmentNames(item.raw).length && !suppliedEvidence.length)
        missing.push("attachment or supplied evidence");
    if (!VALUE_TERMS.some((term) => searchableText(item).includes(term)))
        missing.push("business value signal");
    const evidenceSignals = [
        `description ${item.description.length} chars`,
        `acceptance criteria ${item.acceptanceCriteria.length} chars`,
        `${attachmentNames(item.raw).length} attachment(s)`,
        `${suppliedEvidence.length} supplied evidence snippet(s)`
    ];
    return {
        id: item.id,
        title: item.title,
        evidenceScore: score,
        missingEvidence: missing,
        evidenceSignals,
        recommendation: missing.length ? "Do not approve the requirement decision until missing evidence is supplied." : "Evidence is sufficient for deterministic human review."
    };
}
function cioRiskFor(item, staleDays) {
    const exposure = [];
    let score = 0;
    const stale = daysSince(item.changedDate);
    if (stale >= staleDays && !isTerminal(item.state)) {
        score += 25;
        exposure.push(`stale ${stale} days`);
    }
    if (!item.assignedTo && !isTerminal(item.state)) {
        score += 20;
        exposure.push("no assigned owner");
    }
    const riskSignal = keywordScore(item, RISK_TERMS, 25);
    if (riskSignal) {
        score += riskSignal;
        exposure.push(`regulated/risk language ${riskSignal}`);
    }
    if ((item.priority ?? 99) <= 2 && !isTerminal(item.state)) {
        score += 15;
        exposure.push(`high priority ${item.priority}`);
    }
    const evidence = evidenceScore(item, []);
    if (evidence < 45 && !isTerminal(item.state)) {
        score += 20;
        exposure.push(`weak evidence ${evidence}`);
    }
    return {
        id: item.id,
        title: item.title,
        riskScore: clamp(score, 0, 100),
        severity: severityFor(score),
        exposure,
        owner: item.assignedTo
    };
}
function requirementItems(items) {
    return normalizeItems(items).filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase()));
}
function normalizeItems(items) {
    return items.map((raw) => {
        const record = raw;
        const fields = objectFrom(record.fields);
        const summary = fields ? toSummary(raw) : raw;
        return {
            id: Number(summary.id),
            type: summary.type || stringFrom(fields["System.WorkItemType"]) || "Work Item",
            title: summary.title || stringFrom(fields["System.Title"]) || `Work Item ${summary.id}`,
            state: summary.state || stringFrom(fields["System.State"]) || "",
            assignedTo: summary.assignedTo || displayName(fields["System.AssignedTo"]),
            priority: summary.priority ?? numberFrom(fields["Microsoft.VSTS.Common.Priority"]),
            severity: summary.severity || stringFrom(fields["Microsoft.VSTS.Common.Severity"]),
            tags: summary.tags || tagsFrom(fields["System.Tags"]),
            createdDate: summary.createdDate || stringFrom(fields["System.CreatedDate"]),
            changedDate: summary.changedDate || stringFrom(fields["System.ChangedDate"]),
            areaPath: summary.areaPath || stringFrom(fields["System.AreaPath"]),
            iterationPath: summary.iterationPath || stringFrom(fields["System.IterationPath"]),
            parentId: summary.parentId ?? parentIdFromRelations(record),
            description: textFromFields(fields, ["System.Description", "Custom.Description"]),
            acceptanceCriteria: textFromFields(fields, ["Microsoft.VSTS.Common.AcceptanceCriteria", "Custom.AcceptanceCriteria"]),
            raw: record
        };
    });
}
function evidenceScore(item, suppliedEvidence) {
    let score = 0;
    if (item.description.length >= 160)
        score += 25;
    else if (item.description.length >= 60)
        score += 12;
    if (item.acceptanceCriteria.length >= 80)
        score += 25;
    else if (item.acceptanceCriteria.length >= 30)
        score += 12;
    score += Math.min(20, attachmentNames(item.raw).length * 10);
    score += Math.min(20, suppliedEvidence.filter((entry) => entry.length >= 30).length * 10);
    if (EVIDENCE_FIELDS.some((field) => textFromFields(objectFrom(item.raw.fields), [field]).length >= 80))
        score += 10;
    return clamp(score, 0, 100);
}
function evidenceMap(evidence) {
    const mapped = new Map();
    for (const entry of evidence) {
        const id = numberFrom(entry.workItemId) ?? numberFrom(entry.id);
        if (!id)
            continue;
        const text = stringFrom(entry.text) || stringFrom(entry.summary) || stringFrom(entry.textPreview);
        if (!text)
            continue;
        mapped.set(id, [...(mapped.get(id) || []), stripHtml(text)]);
    }
    return mapped;
}
function keywordScore(item, terms, perHit) {
    const text = searchableText(item);
    const hits = terms.filter((term) => text.includes(term)).length;
    return Math.min(40, hits * perHit);
}
function searchableText(item) {
    return `${item.title} ${item.description} ${item.acceptanceCriteria} ${item.tags.join(" ")}`.toLowerCase();
}
function recommendationForDecision(decision) {
    if (decision === "accelerate")
        return "Prioritize for decision and delivery sequencing.";
    if (decision === "close")
        return "Confirm terminal state and remove from active decision review.";
    if (decision === "park")
        return "Park until owner, value, or evidence changes.";
    return "Review evidence, value, and risk signals before changing state.";
}
function attachmentNames(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    return relations
        .filter((relation) => relation.rel === "AttachedFile")
        .map((relation) => stringFrom(objectFrom(relation.attributes).name) || "attachment");
}
function parentIdFromRelations(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    const relation = relations.find((entry) => entry.rel === "System.LinkTypes.Hierarchy-Reverse" || objectFrom(entry.attributes).name === "Parent");
    const match = stringFrom(relation?.url).match(/\/(\d+)$/);
    return match ? Number(match[1]) : undefined;
}
function textFromFields(fields, names) {
    return stripHtml(names.map((name) => stringFrom(fields[name])).filter(Boolean).join(" "));
}
function displayName(value) {
    if (typeof value === "string")
        return value;
    const record = objectFrom(value);
    return stringFrom(record.displayName) || stringFrom(record.uniqueName) || undefined;
}
function tagsFrom(value) {
    return stringFrom(value).split(";").map((tag) => tag.trim()).filter(Boolean);
}
function isTerminal(state) {
    return TERMINAL_STATES.has(state.toLowerCase());
}
function daysSince(value) {
    if (!value)
        return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? Math.floor((Date.now() - time) / 86_400_000) : 0;
}
function severityFor(score) {
    if (score >= 85)
        return "critical";
    if (score >= 60)
        return "high";
    if (score >= 35)
        return "medium";
    return "low";
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(value)));
}
function objectFrom(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function numberFrom(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}
function stringFrom(value) {
    return typeof value === "string" ? value : "";
}
function stripHtml(value) {
    return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function report(title, findings, summary, metrics = {}) {
    return {
        title,
        generatedAt: new Date().toISOString(),
        summary,
        findings,
        metrics: { findings: findings.length, ...metrics },
        nextActions: ["Review evidence before state changes.", "Use preview/apply workflows for any write.", "Record final decisions with an owner and rationale."]
    };
}
