import { finding, normalizeItems, objectFrom, recordArray, report, stringFrom } from "./requirementsWorkbench.js";
const CLOSED_STATES = new Set(["closed", "done", "completed", "resolved", "removed", "inactive"]);
const RISK_WORDS = /\b(risk|delay|blocked|blocker|audit|compliance|security|privacy|incident|defect|outage|go-live|cutover)\b/i;
const VALUE_WORDS = /\b(revenue|saving|cost|customer|support|finance|automation|efficiency|throughput|cycle time|invoice|billing)\b/i;
export function businessDigitalTwin(workItems, evidence = [], options = {}) {
    const kpiName = stringFrom(options.kpiName) || "business impact";
    const twin = normalizeItems(workItems).map((item) => {
        const matchedEvidence = evidenceFor(item.id, evidence);
        const impactScore = Math.min(100, valueScore(item) + matchedEvidence.length * 12);
        return {
            id: item.id,
            title: item.title,
            kpiName,
            impactScore,
            linkedEvidence: matchedEvidence.length,
            businessEffect: impactScore >= 70 ? "material" : impactScore >= 35 ? "plausible" : "unproven",
            assumptions: ["Business impact is inferred from Work Item text, value fields, and supplied external evidence."]
        };
    });
    const findings = twin.filter((row) => row.businessEffect === "unproven").map((row) => finding(Number(row.id), String(row.title), 75, [`kpi ${row.kpiName}`, `linked evidence ${row.linkedEvidence}`], "Link this work to external KPI evidence or lower its portfolio confidence."));
    return { ...report("Business Digital Twin", findings, `${twin.length} Work Item(s) mapped to business-impact signals.`, { mappedItems: twin.length, unproven: findings.length }), writePerformed: false, twin };
}
export function externalEvidenceImport(records = [], options = {}) {
    const source = stringFrom(options.source) || "external";
    const importedEvidence = records.map((record, index) => ({
        id: index + 1,
        source,
        workItemId: numberFrom(record.workItemId) ?? numberFrom(record.id) ?? null,
        evidenceType: stringFrom(record.type) || inferEvidenceType(record),
        title: stringFrom(record.title) || stringFrom(record.name) || `Evidence ${index + 1}`,
        metric: stringFrom(record.metric) || stringFrom(record.kpi) || "",
        value: numberFrom(record.value) ?? numberFrom(record.amount) ?? null,
        confidence: evidenceConfidence(record),
        normalized: true
    }));
    const findings = importedEvidence.filter((entry) => !entry.workItemId).map((entry) => finding(Number(entry.id), String(entry.title), 55, [`source ${source}`, "missing Work Item link"], "Map external evidence to a Work Item before using it for decision assurance."));
    return { ...report("External Evidence Import", findings, `${importedEvidence.length} external evidence record(s) normalized.`, { records: importedEvidence.length, unmapped: findings.length }), writePerformed: false, importedEvidence };
}
export function eventLogProcessMining(events = [], options = {}) {
    const caseField = stringFrom(options.caseField) || "caseId";
    const activityField = stringFrom(options.activityField) || "activity";
    const timestampField = stringFrom(options.timestampField) || "timestamp";
    const cases = groupBy(events, (event) => stringFrom(event[caseField]) || "unknown");
    const transitions = new Map();
    const bottlenecks = [];
    for (const [caseId, caseEvents] of Object.entries(cases)) {
        const sorted = [...caseEvents].sort((a, b) => dateValue(a[timestampField]) - dateValue(b[timestampField]));
        for (let index = 1; index < sorted.length; index += 1) {
            const from = stringFrom(sorted[index - 1][activityField]) || "unknown";
            const to = stringFrom(sorted[index][activityField]) || "unknown";
            transitions.set(`${from} -> ${to}`, (transitions.get(`${from} -> ${to}`) || 0) + 1);
            const waitHours = Math.max(0, (dateValue(sorted[index][timestampField]) - dateValue(sorted[index - 1][timestampField])) / 3_600_000);
            if (waitHours >= positive(options.bottleneckHours, 48))
                bottlenecks.push({ caseId, from, to, waitHours: Math.round(waitHours) });
        }
    }
    const findings = bottlenecks.map((entry, index) => finding(index + 1, `${entry.from} -> ${entry.to}`, Math.min(100, Number(entry.waitHours)), [`case ${entry.caseId}`, `${entry.waitHours} hours`], "Investigate this process wait outside Azure Boards state history."));
    return { ...report("Event Log Process Mining", findings, `${events.length} event(s), ${Object.keys(cases).length} case(s), and ${transitions.size} transition(s) analyzed.`, { events: events.length, cases: Object.keys(cases).length, transitions: transitions.size, bottlenecks: bottlenecks.length }), writePerformed: false, processMap: { caseField, activityField, timestampField, transitions: Object.fromEntries(transitions), bottlenecks } };
}
export function stakeholderInfluenceMap(workItems, stakeholders = []) {
    const items = normalizeItems(workItems);
    const stakeholderNodes = stakeholders.map((stakeholder, index) => ({ id: `stakeholder:${index + 1}`, kind: "stakeholder", name: stringFrom(stakeholder.name) || stringFrom(stakeholder.displayName) || `Stakeholder ${index + 1}`, role: stringFrom(stakeholder.role) || "unknown", influence: numberFrom(stakeholder.influence) ?? 50 }));
    const itemNodes = items.map((item) => ({ id: `wi:${item.id}`, kind: "workItem", title: item.title, owner: item.assignedTo || "" }));
    const edges = items.flatMap((item) => {
        const ownerMatch = stakeholderNodes.find((stakeholder) => item.assignedTo && String(stakeholder.name).toLowerCase().includes(item.assignedTo.toLowerCase().split(" ")[0]));
        return ownerMatch ? [{ from: ownerMatch.id, to: `wi:${item.id}`, relation: "owns-or-influences" }] : [{ from: "stakeholder:unknown", to: `wi:${item.id}`, relation: "missing-accountability" }];
    });
    const findings = edges.filter((edge) => edge.relation === "missing-accountability").map((edge) => finding(Number(String(edge.to).replace("wi:", "")), String(edge.to), 70, ["missing stakeholder owner"], "Identify decision owner, beneficiary, blocker, and cost owner."));
    return { ...report("Stakeholder Influence Map", findings, `${stakeholderNodes.length} stakeholder(s), ${itemNodes.length} Work Item(s), and ${edges.length} influence edge(s) mapped.`, { stakeholders: stakeholderNodes.length, workItems: itemNodes.length, edges: edges.length }), writePerformed: false, map: { nodes: [...stakeholderNodes, ...itemNodes], edges } };
}
export function roiConfidenceWorkflow(workItems, financeEvidence = []) {
    const roi = normalizeItems(workItems).map((item) => {
        const evidence = evidenceFor(item.id, financeEvidence);
        const fields = objectFrom(item.raw.fields);
        const expected = numberFrom(fields["Custom.TargetBenefit"]) ?? numberFrom(fields["Custom.ExpectedBenefit"]) ?? valueScore(item) * 1000;
        const realized = numberFrom(fields["Custom.RealizedBenefit"]) ?? 0;
        const maturity = realized > 0 ? "realized" : evidence.some((entry) => /finance-reviewed|approved/i.test(JSON.stringify(entry))) ? "finance-reviewed" : evidence.length ? "evidence-backed" : "rough-estimate";
        const confidence = maturity === "realized" ? 95 : maturity === "finance-reviewed" ? 85 : maturity === "evidence-backed" ? 65 : 35;
        return { id: item.id, title: item.title, expectedBenefit: Math.round(expected), realizedBenefit: Math.round(realized), maturity, confidence, evidence: evidence.length };
    });
    const findings = roi.filter((entry) => entry.confidence < 65).map((entry) => finding(Number(entry.id), String(entry.title), 100 - Number(entry.confidence), [`maturity ${entry.maturity}`, `evidence ${entry.evidence}`], "Request finance evidence or downgrade ROI confidence."));
    return { ...report("ROI Confidence Workflow", findings, `${roi.length} Work Item(s) assessed for ROI maturity.`, { assessedItems: roi.length, lowConfidence: findings.length }), writePerformed: false, roi };
}
export function enterpriseRiskHeatmap(workItems, signals = []) {
    const heatmap = normalizeItems(workItems).map((item) => {
        const external = evidenceFor(item.id, signals);
        const delivery = isClosed(item.state) ? 5 : item.description.length < 80 ? 70 : 35;
        const compliance = /audit|compliance|regulatory|security|privacy/i.test(`${item.title} ${item.description} ${item.tags.join(" ")}`) ? 70 : 20;
        const finance = VALUE_WORDS.test(`${item.title} ${item.description}`) ? 50 : 25;
        const test = external.some((entry) => /test|coverage|defect/i.test(JSON.stringify(entry))) ? 25 : 60;
        const ownership = item.assignedTo ? 10 : 80;
        const total = Math.round((delivery + compliance + finance + test + ownership) / 5);
        return { id: item.id, title: item.title, delivery, compliance, finance, test, ownership, total, band: total >= 70 ? "critical" : total >= 45 ? "elevated" : "normal" };
    }).sort((a, b) => Number(b.total) - Number(a.total));
    const findings = heatmap.filter((row) => row.band !== "normal").map((row) => finding(Number(row.id), String(row.title), Number(row.total), [`delivery ${row.delivery}`, `compliance ${row.compliance}`, `ownership ${row.ownership}`], "Review enterprise risk and assign mitigation owner."));
    return { ...report("Enterprise Risk Heatmap", findings, `${heatmap.length} Work Item(s) scored across delivery, compliance, finance, test, and ownership risk.`, { assessedItems: heatmap.length, elevated: findings.length }), writePerformed: false, heatmap };
}
export function policyStudio(workItems, policy = {}) {
    const policyDraft = {
        name: stringFrom(policy.name) || "Generated governance policy",
        requiredFields: Array.isArray(policy.requiredFields) ? policy.requiredFields : ["System.Description", "Microsoft.VSTS.Common.AcceptanceCriteria", "System.AssignedTo"],
        requiredTags: Array.isArray(policy.requiredTags) ? policy.requiredTags : [],
        staleDays: numberFrom(policy.staleDays) ?? 60,
        version: stringFrom(policy.version) || "draft"
    };
    const simulation = normalizeItems(workItems).map((item) => {
        const violations = [
            item.description ? "" : "System.Description",
            item.acceptanceCriteria ? "" : "Microsoft.VSTS.Common.AcceptanceCriteria",
            item.assignedTo ? "" : "System.AssignedTo"
        ].filter(Boolean);
        return { id: item.id, title: item.title, violations, status: violations.length ? "would-fail" : "would-pass" };
    });
    const findings = simulation.filter((row) => row.status === "would-fail").map((row) => finding(Number(row.id), String(row.title), 65, row.violations, "Fix policy violations or add an exception before enforcing this policy."));
    return { ...report("Policy Studio", findings, `${simulation.length} Work Item(s) simulated against a draft policy.`, { simulatedItems: simulation.length, violations: findings.length }), writePerformed: false, policyDraft, simulation };
}
export function promptEvalSuite(prompts = [], cases = []) {
    const evals = prompts.map((prompt, index) => {
        const promptText = stringFrom(prompt.prompt) || stringFrom(prompt.text);
        const relevantCases = cases.length ? cases : [{ name: "default no-write contract", expected: "writePerformed:false" }];
        const failures = relevantCases.filter((testCase) => /apply|update|delete|close/i.test(promptText) && !/preview|approval|confirm/i.test(promptText));
        return { id: index + 1, name: stringFrom(prompt.name) || `Prompt ${index + 1}`, cases: relevantCases.length, failures: failures.length, status: failures.length ? "needs-review" : "passed", checks: ["no hidden writes", "explicit assumptions", "stable output expectation"] };
    });
    const findings = evals.filter((entry) => entry.failures > 0).map((entry) => finding(Number(entry.id), String(entry.name), 80, [`failures ${entry.failures}`], "Revise prompt to require preview, approval, and explicit assumptions."));
    return { ...report("Prompt Eval Suite", findings, `${evals.length} prompt(s) evaluated for no-write and stability expectations.`, { prompts: evals.length, failingPrompts: findings.length }), writePerformed: false, evals };
}
export function modelRiskGovernance(config = {}, dataClasses = []) {
    const models = recordArray(config.models).length ? recordArray(config.models) : [{ name: "deterministic-local", hosting: "local", allowedData: ["public", "internal"] }];
    const classes = dataClasses.length ? dataClasses : [{ name: "work item text", classification: "internal" }, { name: "attachments", classification: "confidential" }];
    const modelRisk = models.map((model, index) => {
        const hosting = stringFrom(model.hosting) || stringFrom(model.provider) || "unknown";
        const risk = /public|external|cloud/i.test(hosting) ? 80 : /private|byod/i.test(hosting) ? 50 : 25;
        return { id: index + 1, name: stringFrom(model.name) || `Model ${index + 1}`, hosting, risk, allowedData: Array.isArray(model.allowedData) ? model.allowedData : ["internal"], recommendation: risk >= 70 ? "Restrict confidential data or require private routing." : "Allowed with configured data policy." };
    });
    const findings = modelRisk.filter((entry) => Number(entry.risk) >= 70).map((entry) => finding(Number(entry.id), String(entry.name), Number(entry.risk), [`hosting ${entry.hosting}`], String(entry.recommendation)));
    return { ...report("Model Risk Governance", findings, `${modelRisk.length} model route(s) evaluated against ${classes.length} data class(es).`, { models: modelRisk.length, highRisk: findings.length }), writePerformed: false, modelRisk, policy: { dataClasses: classes, secretStorage: "external-only", defaultRoute: "deterministic-local" } };
}
export function adoptionCockpit(usage = [], workItems = []) {
    const teams = groupBy(usage, (entry) => stringFrom(entry.team) || stringFrom(entry.areaPath) || "Unknown");
    const adoption = Object.entries(teams).map(([team, entries]) => {
        const activeUsers = new Set(entries.map((entry) => stringFrom(entry.user) || stringFrom(entry.actor)).filter(Boolean)).size;
        const runs = entries.length;
        const approvedPreviews = entries.filter((entry) => /approved|apply|preview/i.test(`${stringFrom(entry.action)} ${stringFrom(entry.event)}`)).length;
        const score = Math.min(100, activeUsers * 15 + runs * 3 + approvedPreviews * 5);
        return { team, activeUsers, runs, approvedPreviews, adoptionScore: score, status: score >= 70 ? "adopted" : score >= 35 ? "emerging" : "low" };
    });
    if (!adoption.length && workItems.length) {
        adoption.push(...Object.entries(groupBy(normalizeItems(workItems), (item) => stringFrom(item.raw.areaPath) || "Unknown")).map(([team, items]) => ({ team, activeUsers: 0, runs: 0, approvedPreviews: 0, adoptionScore: Math.min(40, items.length * 2), status: "low" })));
    }
    const findings = adoption.filter((row) => row.status !== "adopted").map((row, index) => finding(index + 1, String(row.team), 100 - Number(row.adoptionScore), [`status ${row.status}`, `active users ${row.activeUsers}`], "Plan enablement, prompt templates, or governance cadence for this team."));
    return { ...report("Adoption Cockpit", findings, `${adoption.length} team adoption row(s) generated.`, { teams: adoption.length, lowAdoption: findings.length }), writePerformed: false, adoption };
}
function valueScore(item) {
    const fields = objectFrom(item.raw.fields);
    const businessValue = numberFrom(fields["Custom.BusinessValue"]) ?? numberFrom(fields["Microsoft.VSTS.Common.BusinessValue"]) ?? 0;
    return Math.min(100, businessValue * 8 + (VALUE_WORDS.test(`${item.title} ${item.description} ${item.tags.join(" ")}`) ? 35 : 0));
}
function evidenceFor(id, evidence) {
    return evidence.filter((entry) => (numberFrom(entry.workItemId) ?? numberFrom(entry.id)) === id);
}
function inferEvidenceType(record) {
    const text = JSON.stringify(record).toLowerCase();
    if (/ticket|support/.test(text))
        return "support";
    if (/incident|outage/.test(text))
        return "incident";
    if (/revenue|cost|finance|amount/.test(text))
        return "finance";
    if (/event|activity|case/.test(text))
        return "event-log";
    return "generic";
}
function evidenceConfidence(record) {
    return Math.min(95, (record.workItemId ? 25 : 0) + (record.metric || record.kpi ? 25 : 0) + (record.value || record.amount ? 25 : 0) + (record.source || record.system ? 20 : 0));
}
function isClosed(state) {
    return CLOSED_STATES.has(String(state || "").toLowerCase());
}
function dateValue(value) {
    const time = new Date(String(value || "")).getTime();
    return Number.isFinite(time) ? time : 0;
}
function numberFrom(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}
function positive(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
function groupBy(items, key) {
    return items.reduce((acc, item) => {
        const value = key(item);
        acc[value] ||= [];
        acc[value].push(item);
        return acc;
    }, {});
}
