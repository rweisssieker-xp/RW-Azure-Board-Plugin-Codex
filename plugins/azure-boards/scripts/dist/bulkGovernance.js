import { toSummary } from "./azureDevOps.js";
const TERMINAL_STATES = new Set(["closed", "done", "completed", "removed", "inactive"]);
const WSJF_FIELDS = {
    businessValue: "Custom.BusinessValue",
    timeCriticality: "Custom.TimeCriticality",
    riskReduction: "Custom.RiskReduction",
    costOfDelay: "Custom.CostOfDelay",
    jobDuration: "Custom.JobDuration"
};
export function wsjfConsistencyCheck(items) {
    const findings = normalizeItems(items)
        .map((item) => {
        const values = wsjfValues(item.raw);
        const signals = businessSignals(item);
        const notes = [];
        if (values.costOfDelay !== undefined && values.businessValue !== undefined && values.timeCriticality !== undefined && values.riskReduction !== undefined) {
            const sum = values.businessValue + values.timeCriticality + values.riskReduction;
            if (values.costOfDelay !== sum)
                notes.push(`CostOfDelay ${values.costOfDelay} does not equal BV+TC+RR ${sum}`);
        }
        if (values.costOfDelay !== undefined && (values.jobDuration === undefined || values.jobDuration <= 0))
            notes.push("CostOfDelay is present but JobDuration is missing or invalid");
        if (signals.includes("Compliance") && ((values.timeCriticality ?? 0) < 3 || (values.riskReduction ?? 0) < 3))
            notes.push("compliance signal with low TimeCriticality/RiskReduction");
        if (signals.includes("Financial") && ((values.businessValue ?? 0) < 3 || (values.costOfDelay ?? 0) < 3))
            notes.push("financial signal with low BusinessValue/CostOfDelay");
        if (signals.includes("Problem") && ((values.timeCriticality ?? 0) < 3 && (values.riskReduction ?? 0) < 3))
            notes.push("problem/defect signal with low urgency and risk reduction");
        if (item.description.length < 140 && highWsjf(values))
            notes.push("high WSJF values despite weak description");
        if (!notes.length)
            return null;
        return {
            id: item.id,
            title: item.title,
            score: Math.min(100, notes.length * 25 + signals.length * 5),
            severity: notes.length >= 3 ? "high" : "medium",
            signals: [...signals, ...notes, wsjfSummary(values)],
            recommendation: "Review WSJF fields against the Description, attachments, business impact, and delivery effort."
        };
    })
        .filter((finding) => Boolean(finding))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    return report("WSJF Consistency Check", findings, `${findings.length} Work Items have WSJF values that should be reviewed against their evidence.`);
}
export function businessValueEstimate(items) {
    const estimates = normalizeItems(items).map((item) => {
        const signals = businessSignals(item);
        const wsjf = wsjfValues(item.raw).wsjf;
        const estimate = euroEstimate(item, signals, wsjf);
        return {
            id: item.id,
            title: item.title,
            state: item.state,
            priority: item.priority,
            signals,
            estimatedAnnualBenefitLow: estimate.low,
            estimatedAnnualBenefitHigh: estimate.high,
            estimatedAnnualBenefitMidpoint: Math.round((estimate.low + estimate.high) / 2),
            confidence: item.description.length > 600 ? "medium" : "low",
            rationale: estimate.rationale,
            recommendation: estimate.high < 25_000 ? "park or close unless a stronger business case exists" : estimate.low >= 50_000 ? "prioritize or assign business owner" : "review and bundle with related work"
        };
    });
    const findings = estimates
        .map((estimate) => ({
        id: Number(estimate.id),
        title: String(estimate.title),
        score: Math.min(100, Math.round(Number(estimate.estimatedAnnualBenefitMidpoint) / 2_500)),
        severity: Number(estimate.estimatedAnnualBenefitHigh) >= 150_000 ? "high" : "medium",
        signals: [String(estimate.signals), String(estimate.rationale), `estimated ${estimate.estimatedAnnualBenefitLow}-${estimate.estimatedAnnualBenefitHigh} EUR/year`],
        recommendation: String(estimate.recommendation)
    }))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    return {
        ...report("Business Value Estimate", findings, "Annual benefit is a conservative heuristic range, not a finance-approved ROI."),
        estimates
    };
}
export function attachmentEvidenceSummary(items, attachmentTexts = []) {
    const textById = new Map();
    for (const entry of attachmentTexts) {
        const id = numberFrom(entry.workItemId) ?? numberFrom(entry.id);
        if (!id)
            continue;
        const text = stringFrom(entry.text) || stringFrom(entry.textPreview) || stringFrom(entry.summary);
        if (!text)
            continue;
        textById.set(id, [...(textById.get(id) || []), text]);
    }
    const findings = normalizeItems(items).map((item) => {
        const attachments = attachmentRelations(item.raw);
        const suppliedTexts = textById.get(item.id) || [];
        const supported = attachments.filter((attachment) => /\.(docx|xlsx|xlsm|pdf|xml|csv|txt)$/i.test(attachment.name));
        const signals = [
            `${attachments.length} attachment(s)`,
            `${supported.length} directly parseable by common local tooling`,
            `${suppliedTexts.length} supplied extracted text snippet(s)`
        ];
        if (attachments.length)
            signals.push(`files: ${attachments.slice(0, 5).map((attachment) => attachment.name).join(", ")}`);
        if (suppliedTexts.length)
            signals.push(`evidence: ${suppliedTexts.join(" ").slice(0, 240)}`);
        return {
            id: item.id,
            title: item.title,
            score: Math.min(100, attachments.length * 20 + suppliedTexts.length * 30),
            severity: attachments.length && !suppliedTexts.length ? "medium" : "low",
            signals,
            recommendation: attachments.length && !suppliedTexts.length ? "Read supported attachments before final business or closure decisions." : "Use attachment evidence as supporting context, not as automatic approval to write."
        };
    });
    return report("Attachment Evidence Summary", findings, "Attachment evidence is summarized from relation metadata and optional extracted text supplied by the caller.");
}
export function closeCandidates(items, options = {}) {
    const minAgeDays = numberFrom(options.minAgeDays) ?? 90;
    const findings = normalizeItems(items)
        .filter((item) => !isTerminal(item.state))
        .map((item) => {
        const signals = [];
        let score = 0;
        const changedAge = daysSince(item.changedDate);
        if (changedAge >= minAgeDays) {
            score += 25;
            signals.push(`stale for ${changedAge} days`);
        }
        if ((item.priority ?? 99) >= 3) {
            score += 25;
            signals.push(`low priority ${item.priority}`);
        }
        if (item.description.length < 160) {
            score += 20;
            signals.push("weak Description");
        }
        const values = wsjfValues(item.raw);
        if ((values.wsjf ?? 999) <= 3) {
            score += 25;
            signals.push(`low WSJF ${values.wsjf ?? "n/a"}`);
        }
        if (!signals.length)
            return null;
        return {
            id: item.id,
            title: item.title,
            score: Math.min(100, score),
            severity: score >= 60 ? "high" : "medium",
            signals,
            recommendation: "Create a bulk-close preview and require explicit approval before writing."
        };
    })
        .filter((finding) => Boolean(finding))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    return report("AI Close Candidates", findings, `${findings.length} items look like closure candidates. No writes were performed.`);
}
export function bulkClosePreview(items, options = {}) {
    const targetState = stringFrom(options.targetState) || "Closed";
    const reason = stringFrom(options.reason) || "Formal backlog cleanup based on value, WSJF, or governance review.";
    const includeChildren = options.includeChildren !== false;
    const normalized = normalizeItems(items);
    const parents = normalized.filter((item) => !isTerminal(item.state));
    const targets = [];
    const skipped = [];
    for (const item of normalized) {
        if (isTerminal(item.state)) {
            skipped.push({ id: item.id, title: item.title, reason: `already terminal (${item.state})` });
        }
    }
    for (const item of parents) {
        const childImpact = includeChildren ? childTargets(item, normalized, reason) : [];
        targets.push(targetFor(item, targetState, reason, childImpact));
    }
    return {
        title: "Bulk Close Preview",
        generatedAt: new Date().toISOString(),
        writePerformed: false,
        summary: `${targets.length} parent item(s) and ${targets.reduce((sum, target) => sum + target.childImpact.length, 0)} child item(s) planned for closure. No writes were performed.`,
        approvalRequired: true,
        targets,
        skipped,
        metrics: {
            requestedItems: items.length,
            plannedParents: targets.length,
            plannedChildren: targets.reduce((sum, target) => sum + target.childImpact.length, 0),
            skippedItems: skipped.length
        }
    };
}
export function parentChildCleanup(items) {
    const normalized = normalizeItems(items);
    const byId = new Map(normalized.map((item) => [item.id, item]));
    const findings = [];
    for (const item of normalized) {
        if (item.type.toLowerCase() !== "task" || isTerminal(item.state))
            continue;
        const parent = item.parentId ? byId.get(item.parentId) : undefined;
        if (!parent || parent.type.toLowerCase() !== "requirement" || !isTerminal(parent.state))
            continue;
        findings.push({
            id: item.id,
            title: item.title,
            score: 90,
            severity: "high",
            signals: [`parent requirement #${parent.id} is ${parent.state}`, `task is still ${item.state}`],
            recommendation: "Include this task in a bulk-close preview with a parent-closed rationale."
        });
    }
    return report("Parent/Child Cleanup", findings, `${findings.length} open task(s) have a terminal parent Requirement.`);
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
            priority: summary.priority ?? numberFrom(fields["Microsoft.VSTS.Common.Priority"]),
            changedDate: summary.changedDate || stringFrom(fields["System.ChangedDate"]),
            description: stripHtml(stringFrom(fields["System.Description"]) || stringFrom(record.description)),
            parentId: summary.parentId ?? parentIdFromRelations(record),
            raw: record
        };
    });
}
function targetFor(item, targetState, reason, childImpact) {
    const comment = `${reason} Current item: ${item.type} #${item.id}. No write should be applied unless this preview is explicitly approved.`;
    return {
        id: item.id,
        title: item.title,
        type: item.type,
        currentState: item.state,
        targetState,
        rationale: reason,
        comment,
        patchPreview: [{ op: "replace", path: "/fields/System.State", value: targetState }],
        childImpact,
        risk: childImpact.length ? "medium" : "low"
    };
}
function childTargets(parent, allItems, reason) {
    return allItems
        .filter((item) => item.parentId === parent.id && !isTerminal(item.state))
        .map((item) => targetFor(item, "Closed", `Child closure because parent #${parent.id} is planned for closure. ${reason}`, []));
}
function businessSignals(item) {
    const text = `${item.title} ${item.description}`.toLowerCase();
    const signals = [];
    addSignal(signals, text, /gesetz|compliance|audit|tüv|validierung|datenschutz|e-rechnung|eudamed|udi|gudid|atlas|zoll|präferenz|berechtigung|coc|declaration|astm/, "Compliance");
    addSignal(signals, text, /rechnung|paypal|zahlung|kreditor|debitor|ledger|kontoauszug|einkaufspreis|preis|kosten|kalkulation|buchung|umsatz|faktura|herstellkosten/, "Financial");
    addSignal(signals, text, /produktion|bde|kanban|lager|material|charge|fertigung|arbeitsplan|kommission|packraum|wartung|etikett|zeichnung|megaboard/, "Production");
    addSignal(signals, text, /schnittstelle|export|import|ssis|webservice|datalake|api|addone|wup|xml|csv/, "Integration");
    addSignal(signals, text, /kunde|crm|lieferschein|kmusa|kusa|portal|service|shop/, "Customer");
    addSignal(signals, text, /manuell|automatisch|automatisiert|job|massendaten|archiv|workflow/, "Automation");
    addSignal(signals, text, /fehler|falsch|problem|langsam|nicht korrekt|fehlt|abweichung|differenz/, "Problem");
    return signals;
}
function euroEstimate(item, signals, wsjf) {
    let low = 5_000;
    let high = 20_000;
    const rationale = [];
    const title = item.title.toLowerCase();
    const set = (nextLow, nextHigh, reason) => {
        low = Math.max(low, nextLow);
        high = Math.max(high, nextHigh);
        rationale.push(reason);
    };
    if (/wup|schnittstelle|ssis|addone/.test(title) || signals.includes("Integration"))
        set(50_000, 180_000, "integration/stammdaten leverage");
    if (signals.includes("Compliance"))
        set(40_000, 150_000, "compliance or audit risk");
    if (signals.includes("Financial"))
        set(25_000, 120_000, "financial process impact");
    if (signals.includes("Production"))
        set(30_000, 160_000, "production/logistics productivity");
    if ((wsjf ?? 0) >= 100) {
        low = Math.round(low * 1.15);
        high = Math.round(high * 1.25);
        rationale.push("high WSJF");
    }
    if ((wsjf ?? 999) <= 3 && signals.length <= 2) {
        low = Math.round(low * 0.6);
        high = Math.round(high * 0.6);
        rationale.push("low WSJF / weak evidence");
    }
    return { low, high, rationale: rationale.join("; ") || "heuristic baseline" };
}
function wsjfValues(raw) {
    const fields = objectFrom(raw.fields);
    const costOfDelay = numberFrom(fields[WSJF_FIELDS.costOfDelay]);
    const jobDuration = numberFrom(fields[WSJF_FIELDS.jobDuration]);
    return {
        businessValue: numberFrom(fields[WSJF_FIELDS.businessValue]),
        timeCriticality: numberFrom(fields[WSJF_FIELDS.timeCriticality]),
        riskReduction: numberFrom(fields[WSJF_FIELDS.riskReduction]),
        costOfDelay,
        jobDuration,
        wsjf: costOfDelay !== undefined && jobDuration !== undefined && jobDuration > 0 ? Math.round((costOfDelay / jobDuration) * 100) / 100 : undefined
    };
}
function wsjfSummary(values) {
    return `WSJF fields: BV=${values.businessValue ?? "n/a"}, TC=${values.timeCriticality ?? "n/a"}, RR=${values.riskReduction ?? "n/a"}, CoD=${values.costOfDelay ?? "n/a"}, JobDuration=${values.jobDuration ?? "n/a"}, WSJF=${values.wsjf ?? "n/a"}`;
}
function highWsjf(values) {
    return Math.max(values.businessValue ?? 0, values.timeCriticality ?? 0, values.riskReduction ?? 0, values.costOfDelay ?? 0) >= 50;
}
function attachmentRelations(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    return relations
        .filter((relation) => relation.rel === "AttachedFile")
        .map((relation) => {
        const attributes = objectFrom(relation.attributes);
        return { name: stringFrom(attributes.name) || "attachment", url: stringFrom(relation.url) };
    });
}
function parentIdFromRelations(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    const relation = relations.find((entry) => entry.rel === "System.LinkTypes.Hierarchy-Reverse" || objectFrom(entry.attributes).name === "Parent");
    const match = stringFrom(relation?.url).match(/\/(\d+)$/);
    return match ? Number(match[1]) : undefined;
}
function addSignal(signals, text, pattern, signal) {
    if (pattern.test(text) && !signals.includes(signal))
        signals.push(signal);
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
function report(title, findings, summary) {
    return {
        title,
        generatedAt: new Date().toISOString(),
        summary,
        findings,
        metrics: { findings: findings.length },
        nextActions: ["Use preview tools before any write.", "Require explicit approval for bulk writes.", "Verify resulting Work Item counts after writes."]
    };
}
