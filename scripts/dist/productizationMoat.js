import { finding, normalizeItems, objectFrom, report, stringFrom, numberFrom } from "./requirementsWorkbench.js";
const REQUIRED_MARKETPLACE_ASSETS = ["privacyUrl", "termsUrl", "supportUrl", "screenshots", "hostedMcpUrl"];
const SENSITIVE_WORDS = /\b(secret|token|pat|password|client_secret|authorization|personal data|confidential|attachment)\b/i;
const CONNECTOR_WORDS = /\b(power bi|fabric|sap|dynamics|service now|servicenow|jira|teams|outlook|sharepoint|monitor|app insights|test plans)\b/i;
const OUTCOME_WORDS = /\b(revenue|saving|cost|efficiency|customer|audit|risk|cycle time|automation|support|finance)\b/i;
export function connectorReadinessAudit(connectors = [], options = {}) {
    const expected = arrayOfStrings(options.expectedConnectors).length
        ? arrayOfStrings(options.expectedConnectors)
        : ["Azure Boards", "Azure Test Plans", "Power BI/Fabric", "ERP", "Teams/Outlook", "SharePoint", "Azure Monitor"];
    const supplied = connectors.map((connector, index) => normalizeConnector(connector, index));
    const readiness = expected.map((name, index) => {
        const match = supplied.find((connector) => connector.name.toLowerCase() === name.toLowerCase() || connector.category.toLowerCase() === name.toLowerCase());
        const configured = Boolean(match?.configured);
        const score = configured ? Math.min(100, 55 + (match?.hasScopes ? 20 : 0) + (match?.hasOwner ? 15 : 0) + (match?.hasHealthCheck ? 10 : 0)) : 20;
        return {
            id: index + 1,
            connector: name,
            status: configured ? (score >= 80 ? "ready" : "partial") : "missing",
            score,
            missing: configured ? missingConnectorControls(match) : ["configuration", "owner", "scopes", "health check"],
            recommendation: configured ? "Complete owner, scopes, and health checks before enterprise rollout." : "Plan connector onboarding or mark this integration out of scope."
        };
    });
    const findings = readiness
        .filter((row) => row.status !== "ready")
        .map((row) => finding(Number(row.id), String(row.connector), 100 - Number(row.score), row.missing, String(row.recommendation)));
    return { ...report("Connector Readiness Audit", findings, `${readiness.length} enterprise connector(s) assessed for rollout readiness.`, { connectors: readiness.length, gaps: findings.length }), writePerformed: false, readiness };
}
export function evidenceIngestionPipeline(records = [], options = {}) {
    const source = stringFrom(options.source) || "uploaded-context";
    const pipeline = records.map((record, index) => {
        const text = `${stringFrom(record.title)} ${stringFrom(record.name)} ${stringFrom(record.text)} ${stringFrom(record.summary)} ${stringFrom(record.description)}`.trim();
        const classification = classifyRecord(record, text);
        const workItemId = numberFrom(record.workItemId) ?? numberFrom(record.id);
        return {
            id: index + 1,
            source,
            workItemId: workItemId ?? null,
            title: stringFrom(record.title) || stringFrom(record.name) || `Evidence ${index + 1}`,
            type: stringFrom(record.type) || inferType(record, text),
            classification,
            extractedSignals: extractedSignals(text),
            retainContent: false,
            status: workItemId ? "linkable" : "needs-mapping"
        };
    });
    const findings = pipeline
        .filter((entry) => entry.status === "needs-mapping" || entry.classification === "sensitive")
        .map((entry) => finding(Number(entry.id), String(entry.title), entry.classification === "sensitive" ? 85 : 60, [`classification ${entry.classification}`, `status ${entry.status}`], "Map evidence to a Work Item and redact sensitive content before using it in reports."));
    return {
        ...report("Evidence Ingestion Pipeline", findings, `${pipeline.length} evidence record(s) normalized without persisting uploaded content.`, { records: pipeline.length, sensitive: pipeline.filter((entry) => entry.classification === "sensitive").length }),
        writePerformed: false,
        pipeline,
        controls: { persistRawContent: false, redactionRequired: true, allowedFormats: ["pdf", "docx", "xlsx", "csv", "json", "txt", "image-metadata"] }
    };
}
export function securityPrivacyReview(config = {}, dataFlows = []) {
    const controls = [
        control("tenant isolation", Boolean(config.tenantIsolation), "Separate tenant data, stores, logs, and credentials."),
        control("rbac", Boolean(config.rbac), "Restrict admin, apply, evidence, and prompt-management operations by role."),
        control("key vault", Boolean(config.keyVault || config.externalSecretStore), "Keep PATs, bearer tokens, and private model keys out of local artifacts and browser storage."),
        control("audit log", Boolean(config.auditLog), "Record analysis, preview, approval, and apply events for enterprise review."),
        control("retention policy", Boolean(config.retentionPolicy), "Define retention for reports, evidence metadata, prompts, and generated artifacts."),
        control("data redaction", Boolean(config.redaction || config.piiRedaction), "Redact sensitive values before model calls or persisted reports.")
    ];
    for (const [index, flow] of dataFlows.entries()) {
        const name = stringFrom(flow.name) || stringFrom(flow.source) || `Data flow ${index + 1}`;
        const risk = SENSITIVE_WORDS.test(JSON.stringify(flow)) ? 80 : 40;
        controls.push({ id: controls.length + 1, name, status: risk >= 70 ? "needs-review" : "acceptable", score: 100 - risk, recommendation: risk >= 70 ? "Add redaction, access scope, and retention controls for this data flow." : "Document this data flow in the security pack." });
    }
    controls.forEach((entry, index) => {
        entry.id = index + 1;
    });
    const findings = controls.filter((entry) => entry.status !== "ready" && entry.status !== "acceptable").map((entry) => finding(Number(entry.id), String(entry.name), 100 - Number(entry.score), [`status ${entry.status}`], String(entry.recommendation)));
    return { ...report("Security Privacy Review", findings, `${controls.length} security and privacy control(s) reviewed.`, { controls: controls.length, gaps: findings.length }), writePerformed: false, controls };
}
export function marketplaceSubmissionReadiness(submission = {}, assets = []) {
    const checklist = REQUIRED_MARKETPLACE_ASSETS.map((key, index) => {
        const present = Boolean(submission[key]) || assets.some((asset) => stringFrom(asset.kind) === key || stringFrom(asset.name).toLowerCase().includes(key.toLowerCase()));
        return { id: index + 1, item: key, status: present ? "ready" : "missing", recommendation: present ? "Keep current submission evidence." : `Add ${key} before marketplace review.` };
    });
    const submittedTools = objectFrom(submission.tools);
    checklist.push({ id: checklist.length + 1, item: "tool annotations", status: Object.keys(submittedTools).length ? "ready" : "missing", recommendation: "Every runtime tool should have matching annotations and justifications." }, { id: checklist.length + 1, item: "extension package", status: submission.extensionPackage ? "ready" : "partial", recommendation: "Validate Azure DevOps extension manifest, screenshots, and backend URL settings." });
    const findings = checklist.filter((entry) => entry.status !== "ready").map((entry) => finding(Number(entry.id), String(entry.item), entry.status === "missing" ? 85 : 55, [`status ${entry.status}`], String(entry.recommendation)));
    return { ...report("Marketplace Submission Readiness", findings, `${checklist.length} marketplace readiness item(s) checked.`, { items: checklist.length, gaps: findings.length }), writePerformed: false, checklist };
}
export function orgRolloutReadiness(orgConfig = {}, teams = []) {
    const baseControls = [
        ["executive sponsor", orgConfig.executiveSponsor],
        ["admin consent", orgConfig.adminConsent],
        ["pilot scope", orgConfig.pilotScope],
        ["support owner", orgConfig.supportOwner],
        ["training plan", orgConfig.trainingPlan]
    ];
    const rollout = baseControls.map(([name, value], index) => ({ id: index + 1, area: String(name), status: value ? "ready" : "missing", score: value ? 90 : 25, recommendation: value ? "Keep evidence current." : `Assign ${name} before broad rollout.` }));
    for (const [index, team] of teams.entries()) {
        const users = numberFrom(team.users) ?? numberFrom(team.activeUsers) ?? 0;
        const owner = stringFrom(team.owner);
        const score = Math.min(100, users * 5 + (owner ? 30 : 0) + (team.pilotApproved ? 25 : 0));
        rollout.push({ id: rollout.length + 1, area: stringFrom(team.name) || `Team ${index + 1}`, status: score >= 70 ? "ready" : "pilot-needed", score, recommendation: score >= 70 ? "Start measured rollout with support cadence." : "Confirm owner, pilot users, and training before rollout." });
    }
    const findings = rollout.filter((entry) => entry.status !== "ready").map((entry) => finding(Number(entry.id), String(entry.area), 100 - Number(entry.score), [`status ${entry.status}`], String(entry.recommendation)));
    return { ...report("Organization Rollout Readiness", findings, `${rollout.length} rollout control(s) evaluated.`, { controls: rollout.length, gaps: findings.length }), writePerformed: false, rollout };
}
export function licensePackagingAdvisor(usage = [], options = {}) {
    const activeUsers = new Set(usage.map((entry) => stringFrom(entry.user) || stringFrom(entry.actor)).filter(Boolean)).size;
    const applyEvents = usage.filter((entry) => /apply|approval|bulk close|traceability/i.test(JSON.stringify(entry))).length;
    const enterpriseSignals = usage.filter((entry) => /audit|governance|security|admin|model|policy/i.test(JSON.stringify(entry))).length;
    const packages = [
        { edition: "Team", fitScore: activeUsers <= 25 ? 80 : 45, gates: ["read-only analytics", "local store", "basic previews"], rationale: "Good for project-level board cleanup and reporting." },
        { edition: "Enterprise", fitScore: Math.min(100, activeUsers * 3 + applyEvents * 8 + enterpriseSignals * 5), gates: ["hosted MCP", "RBAC", "audit log", "connector health"], rationale: "Best fit when approvals, governance, and integrations matter." },
        { edition: "Regulated", fitScore: Math.min(100, enterpriseSignals * 12 + (options.requiresCompliance ? 35 : 0)), gates: ["private model routing", "data retention", "redaction", "evidence ledger"], rationale: "Needed for audited or sensitive board data." }
    ];
    const recommended = [...packages].sort((a, b) => b.fitScore - a.fitScore)[0];
    const findings = [finding(undefined, `Recommended edition: ${recommended.edition}`, Number(recommended.fitScore), [`active users ${activeUsers}`, `apply events ${applyEvents}`, `enterprise signals ${enterpriseSignals}`], String(recommended.rationale))];
    return { ...report("License Packaging Advisor", findings, `${packages.length} commercial package option(s) scored from usage signals.`, { activeUsers, applyEvents, enterpriseSignals }), writePerformed: false, packages };
}
export function customerValueCaseBuilder(workItems, evidence = []) {
    const valueCases = normalizeItems(workItems).map((item) => {
        const linked = evidenceFor(item.id, evidence);
        const benefit = benefitEstimate(item.raw, linked);
        const confidence = Math.min(95, (OUTCOME_WORDS.test(`${item.title} ${item.description}`) ? 30 : 10) + (linked.length * 15) + (item.acceptanceCriteria ? 20 : 0) + (item.assignedTo ? 15 : 0));
        return {
            id: item.id,
            title: item.title,
            estimatedAnnualValue: benefit,
            confidence,
            narrative: `${item.title}: value case based on board description, ownership, acceptance evidence, and ${linked.length} linked evidence record(s).`,
            assumptions: ["Annual value is directional and must be validated with finance or process owners."],
            status: confidence >= 70 ? "sales-ready" : "needs-evidence"
        };
    }).sort((a, b) => Number(b.estimatedAnnualValue) - Number(a.estimatedAnnualValue));
    const findings = valueCases.filter((entry) => entry.status === "needs-evidence").map((entry) => finding(Number(entry.id), String(entry.title), 100 - Number(entry.confidence), [`confidence ${entry.confidence}`, `estimated value ${entry.estimatedAnnualValue}`], "Add finance evidence, owner, and measurable outcome before using this as a customer value case."));
    return { ...report("Customer Value Case Builder", findings, `${valueCases.length} customer value case(s) drafted from board and evidence signals.`, { cases: valueCases.length, needsEvidence: findings.length }), writePerformed: false, valueCases };
}
export function proprietarySignalCatalog(workItems, feedback = [], evidence = []) {
    const items = normalizeItems(workItems);
    const signals = [
        signal("poor-description-patterns", items.filter((item) => item.description.length < 80).length, "Requirement quality classifier"),
        signal("wsjf-value-mismatch", items.filter((item) => valueField(item.raw) >= 7 && !OUTCOME_WORDS.test(item.description)).length, "Portfolio economics benchmark"),
        signal("evidence-backed-closure", evidence.filter((entry) => /closed|closure|approved/i.test(JSON.stringify(entry))).length, "Closure rationale corpus"),
        signal("feedback-labels", feedback.length, "Recommendation learning set"),
        signal("connector-specific-patterns", items.filter((item) => CONNECTOR_WORDS.test(`${item.title} ${item.description} ${item.tags.join(" ")}`)).length, "Integration and ERP pattern library")
    ];
    const findings = signals.filter((entry) => Number(entry.count) < 3).map((entry, index) => finding(index + 1, String(entry.name), 65, [`count ${entry.count}`], "Collect more labeled examples before claiming this as a durable data advantage."));
    return { ...report("Proprietary Signal Catalog", findings, `${signals.length} data-moat signal family/families cataloged.`, { signalFamilies: signals.length, weakSignals: findings.length }), writePerformed: false, signals };
}
export function autonomousFollowupScheduler(workItems, options = {}) {
    const cadenceDays = Math.max(1, numberFrom(options.cadenceDays) ?? 7);
    const now = new Date();
    const followups = normalizeItems(workItems)
        .filter((item) => !isTerminal(item.state))
        .map((item) => {
        const staleDays = daysSince(stringFrom(item.raw.changedDate) || stringFrom(objectFrom(item.raw.fields)["System.ChangedDate"]));
        const needsDecision = /decision|approval|clarify|blocked|risk|owner/i.test(`${item.title} ${item.description} ${item.tags.join(" ")}`);
        const due = new Date(now.getTime() + (needsDecision ? 1 : cadenceDays) * 86_400_000).toISOString();
        return { id: item.id, title: item.title, owner: item.assignedTo || "unassigned", dueAt: due, reason: needsDecision ? "decision-or-risk-followup" : staleDays > cadenceDays ? "stale-item-review" : "routine-governance", channel: stringFrom(options.channel) || "manual-review", writePerformed: false };
    })
        .filter((entry) => entry.reason !== "routine-governance" || options.includeRoutine === true)
        .slice(0, 30);
    const findings = followups.map((entry) => finding(Number(entry.id), String(entry.title), entry.reason === "decision-or-risk-followup" ? 80 : 55, [`owner ${entry.owner}`, `reason ${entry.reason}`], "Review and schedule this follow-up through a separate automation or communication workflow."));
    return { ...report("Autonomous Followup Scheduler", findings, `${followups.length} no-write follow-up recommendation(s) prepared.`, { followups: followups.length, cadenceDays }), writePerformed: false, followups };
}
export function adoptionExperimentDesigner(usage = [], teams = [], options = {}) {
    const target = stringFrom(options.targetOutcome) || "increase approved preview usage";
    const teamNames = teams.length ? teams.map((team, index) => stringFrom(team.name) || `Team ${index + 1}`) : Array.from(new Set(usage.map((entry) => stringFrom(entry.team)).filter(Boolean)));
    const baseTeams = teamNames.length ? teamNames : ["Pilot Team"];
    const experiments = baseTeams.map((team, index) => {
        const teamUsage = usage.filter((entry) => stringFrom(entry.team) === team);
        const baseline = teamUsage.length;
        return {
            id: index + 1,
            team,
            targetOutcome: target,
            hypothesis: `If ${team} gets role-specific prompts and a weekly governance routine, then ${target} will improve.`,
            baselineRuns: baseline,
            successMetric: "approved previews per active user",
            durationDays: numberFrom(options.durationDays) ?? 30,
            guardrails: ["no hidden writes", "no secrets in prompts", "human approval for apply tools"]
        };
    });
    const findings = experiments.map((entry) => finding(Number(entry.id), String(entry.team), Number(entry.baselineRuns) ? 45 : 70, [`baseline runs ${entry.baselineRuns}`, `duration ${entry.durationDays} days`], "Run the experiment with explicit success metrics and compare before/after adoption."));
    return { ...report("Adoption Experiment Designer", findings, `${experiments.length} adoption experiment(s) designed.`, { experiments: experiments.length }), writePerformed: false, experiments };
}
function normalizeConnector(connector, index) {
    return {
        name: stringFrom(connector.name) || `Connector ${index + 1}`,
        category: stringFrom(connector.category) || stringFrom(connector.type),
        configured: connector.configured === true || connector.status === "configured" || connector.status === "ready",
        hasScopes: Array.isArray(connector.scopes) && connector.scopes.length > 0,
        hasOwner: Boolean(stringFrom(connector.owner)),
        hasHealthCheck: connector.healthCheck === true || connector.health === "ok"
    };
}
function missingConnectorControls(connector) {
    if (!connector)
        return ["configuration"];
    return [
        connector.hasScopes ? "" : "scopes",
        connector.hasOwner ? "" : "owner",
        connector.hasHealthCheck ? "" : "health check"
    ].filter(Boolean);
}
function classifyRecord(record, text) {
    if (SENSITIVE_WORDS.test(`${JSON.stringify(record)} ${text}`))
        return "sensitive";
    if (/public|marketing|sample/i.test(`${record.classification || ""} ${text}`))
        return "public";
    return "internal";
}
function inferType(record, text) {
    const fileName = `${stringFrom(record.name)} ${stringFrom(record.fileName)}`.toLowerCase();
    if (/\.pdf\b/.test(fileName))
        return "pdf";
    if (/\.docx?\b/.test(fileName))
        return "document";
    if (/\.xlsx?|\.csv\b/.test(fileName))
        return "tabular";
    if (/image|png|jpg|jpeg|mockup/i.test(`${record.type || ""} ${fileName} ${text}`))
        return "image-metadata";
    return "text";
}
function extractedSignals(text) {
    return [
        OUTCOME_WORDS.test(text) ? "business outcome" : "",
        /owner|responsible|approver/i.test(text) ? "owner evidence" : "",
        /accept|test|expected/i.test(text) ? "acceptance evidence" : "",
        /risk|audit|compliance/i.test(text) ? "risk or audit evidence" : ""
    ].filter(Boolean);
}
function control(name, ready, recommendation) {
    return { id: 0, name, status: ready ? "ready" : "missing", score: ready ? 90 : 20, recommendation };
}
function evidenceFor(id, evidence) {
    return evidence.filter((entry) => (numberFrom(entry.workItemId) ?? numberFrom(entry.id)) === id);
}
function benefitEstimate(raw, evidence) {
    const fields = objectFrom(raw.fields);
    const explicit = numberFrom(fields["Custom.TargetBenefit"]) ?? numberFrom(fields["Custom.ExpectedBenefit"]) ?? numberFrom(raw.expectedBenefit);
    if (explicit !== undefined)
        return Math.round(explicit);
    const evidenceValue = evidence.map((entry) => numberFrom(entry.value) ?? numberFrom(entry.amount) ?? 0).reduce((sum, value) => sum + Math.abs(value), 0);
    return Math.round(Math.max(5_000, evidenceValue || valueField(raw) * 10_000));
}
function valueField(raw) {
    const fields = objectFrom(raw.fields);
    return numberFrom(fields["Custom.BusinessValue"]) ?? numberFrom(fields["Microsoft.VSTS.Common.BusinessValue"]) ?? numberFrom(raw.businessValue) ?? 0;
}
function signal(name, count, use) {
    return { name, count, strength: count >= 10 ? "strong" : count >= 3 ? "emerging" : "weak", productUse: use };
}
function isTerminal(state) {
    return /^(closed|done|completed|resolved|removed|inactive)$/i.test(state);
}
function daysSince(value) {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time))
        return 0;
    return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}
function arrayOfStrings(value) {
    return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}
