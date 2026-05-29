const TERMINAL_STATES = new Set(["closed", "done", "completed", "removed", "inactive", "resolved"]);
const DECISION_PATTERN = /\b(decision|approved|approval|rejected|accepted|deferred|waived|exception|sign[- ]?off)\b/i;
const EVIDENCE_PATTERN = /\b(evidence|audit|test|qa|review|approval|attached|attachment|screenshot|log|build|release|pr|pull request|validated|verified)\b/i;
export function closureGovernanceLedger(items, updates = [], options = {}) {
    const normalized = normalizeItems(items);
    const updatesById = groupByWorkItemId(updates);
    const ledger = normalized
        .filter((item) => isTerminal(item.state))
        .map((item) => closureEntry(item, updatesById.get(item.id) || []))
        .sort(byStatusThenId);
    const findings = ledger
        .filter((entry) => entry.governanceStatus !== "complete")
        .map((entry) => ({
        id: entry.id,
        title: entry.title,
        score: entry.governanceStatus === "gap" ? 90 : 60,
        severity: entry.governanceStatus === "gap" ? "high" : "medium",
        signals: [...entry.evidenceSignals, ...entry.missingSignals],
        recommendation: "Add closure rationale, approver, and verifiable evidence before relying on this item in an audit ledger."
    }))
        .sort(byFindingPriority);
    return {
        ...report("Closure Governance Ledger", findings, `${ledger.length} terminal Work Item(s) were evaluated for closure governance evidence.`, options),
        writePerformed: false,
        ledger,
        metrics: {
            terminalItems: ledger.length,
            complete: ledger.filter((entry) => entry.governanceStatus === "complete").length,
            review: ledger.filter((entry) => entry.governanceStatus === "review").length,
            gaps: ledger.filter((entry) => entry.governanceStatus === "gap").length
        }
    };
}
export function auditDecisionLog(items, evidence = [], options = {}) {
    const normalized = normalizeItems(items);
    const byId = new Map(normalized.map((item) => [item.id, item]));
    const decisions = [];
    for (const item of normalized) {
        if (DECISION_PATTERN.test(item.title) || DECISION_PATTERN.test(item.description)) {
            decisions.push({
                id: item.id,
                title: item.title,
                decision: firstSentence(item.description || item.title),
                source: "field",
                actor: item.assignedTo,
                date: item.changedDate,
                rationale: item.description ? firstSentence(item.description) : undefined,
                evidenceSignals: evidenceSignals(item)
            });
        }
        if (isTerminal(item.state)) {
            decisions.push({
                id: item.id,
                title: item.title,
                decision: `State is ${item.state}`,
                source: "state",
                actor: item.assignedTo,
                date: item.changedDate,
                rationale: "Terminal state is treated as a governance decision that needs supporting evidence.",
                evidenceSignals: evidenceSignals(item)
            });
        }
    }
    for (const record of evidence) {
        const id = workItemId(record);
        if (!id || !byId.has(id))
            continue;
        const text = evidenceText(record);
        if (!DECISION_PATTERN.test(text))
            continue;
        const item = byId.get(id);
        decisions.push({
            id,
            title: item.title,
            decision: firstSentence(text),
            source: sourceFromRecord(record),
            actor: actorFrom(record),
            date: stringFrom(record.date) || stringFrom(record.createdDate) || stringFrom(record.revisedDate),
            rationale: text,
            evidenceSignals: evidenceSignals(item, text)
        });
    }
    const unique = dedupeDecisions(decisions).sort(byDecisionDateThenId);
    const findings = unique
        .filter((decision) => !decision.actor || !decision.rationale || decision.evidenceSignals.length === 0)
        .map((decision) => ({
        id: decision.id,
        title: decision.title,
        score: !decision.actor ? 75 : 55,
        severity: !decision.actor ? "high" : "medium",
        signals: [
            `decision source: ${decision.source}`,
            decision.actor ? `actor: ${decision.actor}` : "missing decision actor",
            decision.rationale ? "rationale present" : "missing decision rationale",
            `${decision.evidenceSignals.length} evidence signal(s)`
        ],
        recommendation: "Record decision actor, date, rationale, and linked evidence before audit export."
    }))
        .sort(byFindingPriority);
    return {
        ...report("Audit Decision Log", findings, `${unique.length} decision record(s) were derived from board fields and supplied evidence.`, options),
        writePerformed: false,
        decisions: unique,
        metrics: {
            decisions: unique.length,
            findings: findings.length,
            suppliedEvidenceRecords: evidence.length
        }
    };
}
export function boardHygieneAutomationPreview(items, options = {}) {
    const asOf = dateFrom(options.asOf) || new Date();
    const staleDays = positiveNumber(options.staleDays, 60);
    const evidenceTag = clean(options.evidenceTag) || "Needs evidence";
    const normalized = normalizeItems(items);
    const actions = normalized.flatMap((item) => hygieneActions(item, normalized, asOf, staleDays, evidenceTag)).sort(byActionPriority);
    const findings = actions.map((action) => ({
        id: action.id,
        title: action.title,
        score: action.risk === "medium" ? 70 : 45,
        severity: action.risk === "medium" ? "medium" : "low",
        signals: [action.actionType, action.rationale],
        recommendation: "Review and explicitly approve this preview before applying any board write."
    }));
    return {
        ...report("Board Hygiene Automation Preview", findings, `${actions.length} hygiene action(s) were previewed. No writes were performed.`, options),
        writePerformed: false,
        approvalRequired: true,
        actions,
        metrics: {
            assessedItems: normalized.length,
            previewActions: actions.length,
            mediumRiskActions: actions.filter((action) => action.risk === "medium").length
        }
    };
}
export function evidencePackCompleteness(items, evidence = [], options = {}) {
    const requirements = requiredEvidence(options);
    const evidenceById = groupByWorkItemId(evidence);
    const packs = normalizeItems(items)
        .map((item) => evidencePackEntry(item, evidenceById.get(item.id) || [], requirements))
        .sort((left, right) => left.completeness - right.completeness || left.id - right.id);
    const findings = packs
        .filter((entry) => entry.completeness < 100)
        .map((entry) => ({
        id: entry.id,
        title: entry.title,
        score: 100 - entry.completeness,
        severity: entry.completeness < 50 ? "high" : entry.completeness < 80 ? "medium" : "low",
        signals: [...entry.evidenceSignals, ...entry.missing.map((missing) => `missing ${missing}`)],
        recommendation: "Complete the missing evidence categories before using this item in an audit evidence pack."
    }))
        .sort(byFindingPriority);
    const average = packs.length ? Math.round(packs.reduce((sum, entry) => sum + entry.completeness, 0) / packs.length) : 100;
    return {
        ...report("Evidence Pack Completeness", findings, `${packs.length} Work Item evidence pack(s) were scored for completeness.`, options),
        writePerformed: false,
        packs,
        metrics: {
            assessedItems: packs.length,
            averageCompleteness: average,
            completePacks: packs.filter((entry) => entry.completeness === 100).length,
            incompletePacks: packs.filter((entry) => entry.completeness < 100).length
        }
    };
}
function normalizeItems(items) {
    return items.map((raw) => {
        const record = raw;
        const fields = objectFrom(record.fields);
        const id = numberFrom(record.id) ?? numberFrom(fields["System.Id"]) ?? 0;
        const tags = tagsFrom(record.tags ?? fields["System.Tags"]);
        return {
            id,
            type: clean(record.type) || clean(fields["System.WorkItemType"]) || "Work Item",
            title: clean(record.title) || clean(fields["System.Title"]) || `Work Item ${id}`,
            state: clean(record.state) || clean(fields["System.State"]) || "",
            assignedTo: identity(record.assignedTo) || identity(fields["System.AssignedTo"]),
            priority: numberFrom(record.priority) ?? numberFrom(fields["Microsoft.VSTS.Common.Priority"]),
            tags,
            createdDate: clean(record.createdDate) || clean(fields["System.CreatedDate"]),
            changedDate: clean(record.changedDate) || clean(fields["System.ChangedDate"]),
            description: stripHtml(clean(record.description) || clean(fields["System.Description"])),
            acceptanceCriteria: stripHtml(clean(record.acceptanceCriteria) || clean(fields["Microsoft.VSTS.Common.AcceptanceCriteria"])),
            parentId: numberFrom(record.parentId) ?? parentIdFromRelations(record),
            attachments: attachmentNames(record),
            links: linkNames(record),
            raw: record
        };
    });
}
function closureEntry(item, updates) {
    const signals = evidenceSignals(item, updates.map(evidenceText).join(" "));
    const closedUpdate = updates.find((update) => /state/i.test(evidenceText(update)) && new RegExp(item.state, "i").test(evidenceText(update)));
    const closedDate = clean(closedUpdate?.revisedDate) || clean(closedUpdate?.date) || item.changedDate;
    const closedBy = actorFrom(closedUpdate || {}) || item.assignedTo;
    const missing = [];
    if (!closedDate)
        missing.push("missing closure date");
    if (!closedBy)
        missing.push("missing closure actor");
    if (!item.acceptanceCriteria)
        missing.push("missing acceptance criteria");
    if (!signals.length)
        missing.push("missing closure evidence");
    const governanceStatus = missing.length === 0 ? "complete" : missing.length >= 3 ? "gap" : "review";
    return {
        id: item.id,
        title: item.title,
        type: item.type,
        state: item.state,
        closedDate,
        closedBy,
        evidenceSignals: signals,
        missingSignals: missing,
        governanceStatus
    };
}
function hygieneActions(item, allItems, asOf, staleDays, evidenceTag) {
    const actions = [];
    const age = daysBetween(item.changedDate, asOf);
    if (!item.assignedTo && !isTerminal(item.state)) {
        actions.push(actionFor(item, "request-owner", "Open item has no assigned owner.", [{ op: "add", path: "/fields/System.Tags", value: mergeTags(item.tags, "Needs owner") }], "low"));
    }
    if (age >= staleDays && !isTerminal(item.state)) {
        actions.push(actionFor(item, "refresh-stale-item", `Open item has not changed for ${age} days.`, [], "low"));
    }
    if (!item.acceptanceCriteria && !isTerminal(item.state)) {
        actions.push(actionFor(item, "complete-acceptance-criteria", "Acceptance criteria are missing.", [], "medium"));
    }
    if (!hasEvidence(item) && !item.tags.includes(evidenceTag)) {
        actions.push(actionFor(item, "add-evidence-tag", "No attachment, link, evidence text, or evidence tag was found.", [{ op: "add", path: "/fields/System.Tags", value: mergeTags(item.tags, evidenceTag) }], "medium"));
    }
    if (!isTerminal(item.state) && item.parentId) {
        const parent = allItems.find((candidate) => candidate.id === item.parentId);
        if (parent && isTerminal(parent.state)) {
            actions.push(actionFor(item, "review-terminal-child", `Parent #${parent.id} is terminal (${parent.state}) while child remains ${item.state}.`, [], "medium"));
        }
    }
    return actions;
}
function actionFor(item, actionType, rationale, patchPreview, risk) {
    return {
        id: item.id,
        title: item.title,
        actionType,
        rationale,
        patchPreview,
        commentPreview: `${rationale} This is a preview only; do not write without explicit approval.`,
        risk
    };
}
function evidencePackEntry(item, evidence, requirements) {
    const text = `${item.title} ${item.description} ${item.acceptanceCriteria} ${evidence.map(evidenceText).join(" ")}`;
    const present = [];
    const missing = [];
    for (const requirement of requirements) {
        if (requirementPresent(requirement, item, evidence, text))
            present.push(requirement);
        else
            missing.push(requirement);
    }
    const completeness = requirements.length ? Math.round((present.length / requirements.length) * 100) : 100;
    return {
        id: item.id,
        title: item.title,
        completeness,
        present,
        missing,
        evidenceSignals: evidenceSignals(item, text)
    };
}
function requiredEvidence(options) {
    const configured = [...(options.requiredFields || []), ...(options.requiredEvidence || [])]
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    return configured.length ? Array.from(new Set(configured)) : ["owner", "acceptance criteria", "closure state", "evidence artifact", "decision rationale"];
}
function requirementPresent(requirement, item, evidence, text) {
    if (requirement.includes("owner") || requirement.includes("assigned"))
        return Boolean(item.assignedTo);
    if (requirement.includes("acceptance"))
        return Boolean(item.acceptanceCriteria);
    if (requirement.includes("closure") || requirement.includes("state"))
        return Boolean(item.state);
    if (requirement.includes("artifact") || requirement.includes("attachment") || requirement.includes("evidence"))
        return hasEvidence(item) || evidence.length > 0 || EVIDENCE_PATTERN.test(text);
    if (requirement.includes("decision") || requirement.includes("rationale"))
        return DECISION_PATTERN.test(text) || item.description.length >= 80;
    if (requirement.includes("priority"))
        return item.priority !== undefined;
    if (requirement.includes("link"))
        return item.links.length > 0;
    return text.toLowerCase().includes(requirement.toLowerCase());
}
function evidenceSignals(item, extraText = "") {
    const signals = [];
    if (item.attachments.length)
        signals.push(`${item.attachments.length} attachment(s): ${item.attachments.slice(0, 3).join(", ")}`);
    if (item.links.length)
        signals.push(`${item.links.length} linked artifact(s)`);
    if (item.acceptanceCriteria)
        signals.push("acceptance criteria present");
    if (item.tags.some((tag) => /evidence|audit|approved|validated|verified/i.test(tag)))
        signals.push(`evidence tag: ${item.tags.filter((tag) => /evidence|audit|approved|validated|verified/i.test(tag)).join(", ")}`);
    if (EVIDENCE_PATTERN.test(`${item.description} ${extraText}`))
        signals.push("evidence keywords in text");
    return signals;
}
function hasEvidence(item) {
    return evidenceSignals(item).length > 0;
}
function groupByWorkItemId(records) {
    const grouped = new Map();
    for (const record of records) {
        const id = workItemId(record);
        if (!id)
            continue;
        grouped.set(id, [...(grouped.get(id) || []), record]);
    }
    return grouped;
}
function workItemId(record) {
    return numberFrom(record.workItemId) ?? numberFrom(record.id) ?? numberFrom(objectFrom(record.workItem).id) ?? numberFrom(objectFrom(record.resource).workItemId);
}
function evidenceText(record) {
    const fields = objectFrom(record.fields);
    const revisedFields = objectFrom(record.revisedFields);
    return [
        clean(record.text),
        clean(record.comment),
        clean(record.message),
        clean(record.summary),
        clean(record.title),
        clean(fields["System.History"]),
        clean(fields["System.Description"]),
        clean(revisedFields["System.State"]),
        clean(record.state)
    ].filter(Boolean).join(" ");
}
function sourceFromRecord(record) {
    const type = `${clean(record.type)} ${clean(record.source)}`.toLowerCase();
    if (type.includes("comment"))
        return "comment";
    if (type.includes("update") || record.revisedFields)
        return "update";
    return "field";
}
function dedupeDecisions(decisions) {
    const seen = new Set();
    const unique = [];
    for (const decision of decisions) {
        const key = `${decision.id}|${decision.source}|${decision.date || ""}|${decision.decision.toLowerCase()}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        unique.push(decision);
    }
    return unique;
}
function attachmentNames(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    return relations
        .filter((relation) => relation.rel === "AttachedFile")
        .map((relation) => clean(objectFrom(relation.attributes).name) || "attachment");
}
function linkNames(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    return relations
        .filter((relation) => relation.rel !== "AttachedFile" && relation.rel !== "System.LinkTypes.Hierarchy-Reverse")
        .map((relation) => clean(objectFrom(relation.attributes).name) || clean(relation.rel) || "link");
}
function parentIdFromRelations(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    const relation = relations.find((entry) => entry.rel === "System.LinkTypes.Hierarchy-Reverse" || objectFrom(entry.attributes).name === "Parent");
    const match = clean(relation?.url).match(/\/(\d+)$/);
    return match ? Number(match[1]) : undefined;
}
function mergeTags(tags, tag) {
    return Array.from(new Set([...tags, tag].filter(Boolean))).join("; ");
}
function actorFrom(record) {
    return identity(record.actor) || identity(record.revisedBy) || identity(record.createdBy) || identity(record.author);
}
function identity(value) {
    if (typeof value === "string" && value.trim())
        return value.trim();
    const object = objectFrom(value);
    return clean(object.displayName) || clean(object.uniqueName) || clean(object.name) || undefined;
}
function tagsFrom(value) {
    if (Array.isArray(value))
        return value.map((entry) => clean(entry)).filter(Boolean);
    return clean(value).split(";").map((tag) => tag.trim()).filter(Boolean);
}
function isTerminal(state) {
    return TERMINAL_STATES.has(state.toLowerCase());
}
function daysBetween(value, asOf) {
    if (!value)
        return 0;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
        return 0;
    return Math.max(0, Math.floor((asOf.getTime() - date.getTime()) / 86_400_000));
}
function dateFrom(value) {
    if (!value)
        return undefined;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : undefined;
}
function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}
function numberFrom(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}
function objectFrom(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function stringFrom(value) {
    return typeof value === "string" ? value : "";
}
function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}
function stripHtml(value) {
    return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function firstSentence(value) {
    const cleanValue = stripHtml(value);
    const match = cleanValue.match(/^(.{1,220}?)(?:[.!?]\s|$)/);
    return (match ? match[1] : cleanValue.slice(0, 220)).trim();
}
function byStatusThenId(left, right) {
    const rank = { gap: 0, review: 1, complete: 2 };
    return rank[left.governanceStatus] - rank[right.governanceStatus] || left.id - right.id;
}
function byDecisionDateThenId(left, right) {
    return (left.date || "").localeCompare(right.date || "") || left.id - right.id || left.decision.localeCompare(right.decision);
}
function byActionPriority(left, right) {
    const risk = { medium: 0, low: 1 };
    return risk[left.risk] - risk[right.risk] || left.id - right.id || left.actionType.localeCompare(right.actionType);
}
function byFindingPriority(left, right) {
    return (right.score || 0) - (left.score || 0) || (left.id || 0) - (right.id || 0) || left.title.localeCompare(right.title);
}
function report(title, findings, summary, options) {
    return {
        title,
        generatedAt: dateFrom(options.asOf)?.toISOString() || new Date().toISOString(),
        summary,
        findings,
        metrics: { findings: findings.length },
        nextActions: [
            "Treat this ledger as a no-write audit preview.",
            "Approve any board hygiene changes explicitly before applying writes.",
            "Export closure and decision evidence only after missing signals are resolved."
        ]
    };
}
