import { createHash } from "node:crypto";
import { actionPlan, createProcessBaseline, roleBasedReport, watchlistReport } from "./analytics.js";
import { auditDecisionLog } from "./evidenceLedger.js";
import { saveNamedArtifact } from "./localStore.js";
import { benefitRealizationFollowup, handoverPackGenerator, operatingRhythmPlanner } from "./governanceOperatingSystem.js";
import { aiSteeringCommitteePack } from "./steeringEngine.js";
export const SNAPSHOT_KIND = "process-snapshot";
export const BASELINE_KIND = "process-baseline";
export const APPROVAL_QUEUE_KIND = "approval-queue";
export const AUDIT_TRAIL_KIND = "decision-audit-trail";
export const ADMIN_CONFIG_KIND = "admin-config";
export const DECISION_PACK_KIND = "decision-pack";
const DEFAULT_ROLES = ["product-owner", "scrum-master", "cio", "compliance"];
export function createPersistentSnapshot(name, items, evidence = [], options = {}) {
    const policy = objectFrom(options.policy);
    const snapshot = {
        name,
        capturedAt: new Date().toISOString(),
        itemCount: items.length,
        evidenceCount: evidence.length,
        fingerprint: fingerprint({ items, evidence, policy }),
        metrics: snapshotMetrics(items),
        baseline: createProcessBaseline(items, evidence, policy),
        watchlist: watchlistReport(items, policy),
        roleSummaries: roleCockpitConfig(items, objectFrom(options.roles), policy).cockpits,
        dataRetention: stringFrom(options.dataRetention) || "local-user-store",
        writePerformed: false
    };
    return saveNamedArtifact(SNAPSHOT_KIND, name, snapshot);
}
export function createPersistentBaseline(name, items, updates = [], policy = {}) {
    const baseline = {
        name,
        capturedAt: new Date().toISOString(),
        baseline: createProcessBaseline(items, updates, policy),
        metrics: snapshotMetrics(items),
        policy,
        writePerformed: false
    };
    return saveNamedArtifact(BASELINE_KIND, name, baseline);
}
export function approvalQueue(items, recommendations = [], options = {}) {
    const policy = objectFrom(options.policy);
    const sourceActions = (recommendations.length ? recommendations : actionPlan(items, policy, options).actions || []);
    const queue = sourceActions.map((action, index) => {
        const itemId = numberFrom(action.workItemId) ?? numberFrom(action.id);
        const item = itemId ? items.find((candidate) => candidate.id === itemId) : undefined;
        const risk = item ? queueRisk(item) : "medium";
        return {
            id: stringFrom(action.id) || `approval-${index + 1}`,
            workItemId: itemId,
            title: stringFrom(action.title) || item?.title || `Approval item ${index + 1}`,
            recommendation: stringFrom(action.recommendation) || stringFrom(action.action) || "Review proposed action.",
            risk,
            status: "pending",
            selected: risk !== "high",
            requiresHumanApproval: true,
            patchPreview: action.patchPreview || action.patch || [],
            verification: ["Re-read Work Item before apply.", "Apply only selected approved items.", "Re-query and record outcome."]
        };
    });
    const result = {
        ...report("Approval Queue", queue.map((entry, index) => finding(numberFrom(entry.workItemId), stringFrom(entry.title), entry.risk === "high" ? 85 : 55, ["approval required", `${entry.risk} risk`], "Select, reject, or override before any apply workflow.")), `${queue.length} recommendation(s) prepared for approval review.`, { approvalsPending: queue.length, selectedByDefault: queue.filter((entry) => entry.selected).length }),
        writePerformed: false,
        approvalRequired: true,
        queue
    };
    if (options.persist === true) {
        saveNamedArtifact(APPROVAL_QUEUE_KIND, stringFrom(options.name) || "approval-queue", result);
    }
    return result;
}
export function approvalApplyPlan(queue = [], selection = {}, options = {}) {
    const selectedIds = new Set(arrayOfStrings(selection.selectedIds));
    const rejectedIds = new Set(arrayOfStrings(selection.rejectedIds));
    const overriddenIds = new Set(arrayOfStrings(selection.overriddenIds));
    const actor = stringFrom(selection.actor) || stringFrom(options.actor) || "reviewer";
    const plan = queue.map((entry, index) => {
        const id = stringFrom(entry.id) || `approval-${index + 1}`;
        const selected = selectedIds.size ? selectedIds.has(id) : entry.selected === true;
        const rejected = rejectedIds.has(id);
        const overridden = overriddenIds.has(id);
        const risk = stringFrom(entry.risk) || "medium";
        const status = rejected ? "rejected" : selected || overridden ? risk === "high" && !overridden ? "needs-secondary-approval" : "ready-for-apply" : "not-selected";
        return {
            id,
            workItemId: numberFrom(entry.workItemId),
            title: stringFrom(entry.title),
            status,
            selected: selected || overridden,
            overridden,
            risk,
            patchPreview: entry.patchPreview || [],
            applyTool: stringFrom(options.applyTool) || "approved-preview-apply-tool",
            verification: ["Re-read current Work Item.", "Apply only this approved patch preview.", "Re-query Work Item and compare expected fields.", "Record result in audit trail."]
        };
    });
    const auditEvents = plan
        .filter((entry) => entry.status !== "not-selected")
        .map((entry) => ({
        recommendationId: entry.id,
        workItemId: entry.workItemId,
        actor,
        action: entry.status === "rejected" ? "rejected" : entry.overridden ? "overridden" : "accepted",
        rationale: stringFrom(selection.rationale) || `${entry.status} from approval queue.`,
        outcome: "pending-apply"
    }));
    return {
        ...report("Approval Apply Plan", plan.filter((entry) => entry.status === "needs-secondary-approval").map((entry) => finding(numberFrom(entry.workItemId), stringFrom(entry.title), 90, ["high risk", "secondary approval required"], "Get secondary approval or override rationale before applying.")), `${plan.filter((entry) => entry.status === "ready-for-apply").length} item(s) ready for apply; ${plan.filter((entry) => entry.status === "needs-secondary-approval").length} require secondary approval.`, { ready: plan.filter((entry) => entry.status === "ready-for-apply").length, secondaryApproval: plan.filter((entry) => entry.status === "needs-secondary-approval").length, rejected: plan.filter((entry) => entry.status === "rejected").length }),
        writePerformed: false,
        approvalRequired: true,
        plan,
        auditEvents
    };
}
export function approvalResultReview(plan = [], results = [], currentItems = []) {
    const verification = plan
        .filter((entry) => ["ready-for-apply", "needs-secondary-approval"].includes(stringFrom(entry.status)))
        .map((entry) => {
        const workItemId = numberFrom(entry.workItemId);
        const result = results.find((candidate) => stringFrom(candidate.recommendationId) === stringFrom(entry.id) || numberFrom(candidate.workItemId) === workItemId);
        const current = workItemId ? currentItems.find((item) => item.id === workItemId) : undefined;
        const success = result?.success === true;
        return {
            recommendationId: stringFrom(entry.id),
            workItemId,
            title: stringFrom(entry.title),
            applyResult: result ? (success ? "succeeded" : "failed") : "missing-result",
            currentState: current?.state || "not-requeried",
            verified: Boolean(success && current),
            recommendation: success && current ? "Record verified outcome in the audit trail." : "Re-query the Work Item or inspect the failed apply result before closing the approval."
        };
    });
    const auditEvents = verification.map((entry) => ({
        recommendationId: entry.recommendationId,
        workItemId: entry.workItemId,
        actor: "system",
        action: "recorded",
        rationale: `Apply result ${entry.applyResult}; current state ${entry.currentState}.`,
        outcome: entry.verified ? "verified" : "needs-review"
    }));
    return {
        ...report("Approval Result Review", verification.filter((entry) => !entry.verified).map((entry) => finding(numberFrom(entry.workItemId), stringFrom(entry.title), 80, [stringFrom(entry.applyResult), stringFrom(entry.currentState)], stringFrom(entry.recommendation))), `${verification.filter((entry) => entry.verified).length}/${verification.length} approval result(s) verified.`, { verified: verification.filter((entry) => entry.verified).length, total: verification.length }),
        writePerformed: false,
        verification,
        auditEvents
    };
}
export function auditTrail(events = [], options = {}) {
    const normalized = events.map((event, index) => ({
        id: stringFrom(event.id) || `audit-${index + 1}`,
        at: stringFrom(event.at) || stringFrom(event.date) || new Date().toISOString(),
        actor: stringFrom(event.actor) || stringFrom(options.actor) || "unknown",
        action: normalizeDecisionAction(stringFrom(event.action) || stringFrom(event.status)),
        workItemId: numberFrom(event.workItemId) ?? numberFrom(event.id),
        recommendationId: stringFrom(event.recommendationId),
        rationale: stringFrom(event.rationale) || stringFrom(event.reason) || "No rationale supplied.",
        evidence: arrayOfStrings(event.evidence),
        outcome: stringFrom(event.outcome) || "pending-verification"
    }));
    return {
        ...report("Decision Audit Trail", normalized.map((event) => finding(numberFrom(event.workItemId), `${event.action} by ${event.actor}`, event.action === "overridden" ? 80 : 45, [event.rationale], "Keep the rationale and verification outcome linked to the Work Item.")), `${normalized.length} decision event(s) normalized for audit review.`, { accepted: countActions(normalized, "accepted"), rejected: countActions(normalized, "rejected"), overridden: countActions(normalized, "overridden") }),
        writePerformed: false,
        trail: normalized
    };
}
export function roleCockpitConfig(items, roleConfig = {}, policy = {}) {
    const roles = arrayOfStrings(roleConfig.roles).length ? arrayOfStrings(roleConfig.roles) : DEFAULT_ROLES;
    const cockpits = roles.map((role) => {
        const source = roleBasedReport(items, role, policy);
        return {
            role,
            title: roleTitle(role),
            report: source.title,
            metrics: source.metrics || {},
            topFindings: source.findings.slice(0, 5),
            defaultReports: reportsForRole(role),
            decisionRights: decisionRightsForRole(role)
        };
    });
    return {
        ...report("Role Cockpit Configuration", cockpits.map((cockpit, index) => finding(undefined, stringFrom(cockpit.title), 50 + index, [`${arrayOfStrings(cockpit.defaultReports).length} default reports`], "Use this role cockpit as the default landing view for the team.")), `${cockpits.length} role-specific cockpit(s) prepared.`, { roles: cockpits.length, assessedItems: items.length }),
        writePerformed: false,
        cockpits
    };
}
export function adminConsoleConfig(config = {}) {
    const normalized = {
        policies: objectFrom(config.policies),
        thresholds: {
            slaDays: positive(config.slaDays, 14),
            staleDays: positive(config.staleDays, 21),
            highRiskScore: positive(config.highRiskScore, 75),
            minimumEvidenceCount: positive(config.minimumEvidenceCount, 2)
        },
        riskWeights: {
            stale: positive(config.staleWeight, 20),
            blocked: positive(config.blockedWeight, 25),
            unassigned: positive(config.unassignedWeight, 15),
            businessValue: positive(config.businessValueWeight, 20)
        },
        dataClasses: arrayOfStrings(config.dataClasses).length ? arrayOfStrings(config.dataClasses) : ["work-items", "comments", "attachments-metadata", "external-evidence"],
        llmMode: stringFrom(config.llmMode) || "deterministic-local",
        hostedMcpUrl: stringFrom(config.hostedMcpUrl),
        oauth: {
            tenantId: stringFrom(config.tenantId) || "common",
            clientIdConfigured: Boolean(stringFrom(config.clientId)),
            scopes: arrayOfStrings(config.scopes).length ? arrayOfStrings(config.scopes) : ["Azure DevOps delegated access"]
        }
    };
    const validation = [
        control("privacy policy", Boolean(stringFrom(config.privacyUrl)), "Add production privacy policy URL."),
        control("terms", Boolean(stringFrom(config.termsUrl)), "Add production terms URL."),
        control("hosted MCP", Boolean(normalized.hostedMcpUrl), "Configure reachable hosted MCP endpoint for app review."),
        control("OAuth client", normalized.oauth.clientIdConfigured, "Configure production Microsoft Entra public-client app registration."),
        control("LLM mode", ["deterministic-local", "openai", "private"].includes(normalized.llmMode), "Use deterministic-local, openai, or private.")
    ];
    return {
        ...report("Admin Console Configuration", validation.filter((item) => !item.ready).map((item, index) => finding(undefined, stringFrom(item.name), 70 + index, [stringFrom(item.recommendation)], "Complete before production rollout.")), `${validation.filter((item) => item.ready).length}/${validation.length} production controls are ready.`, { controls: validation.length, ready: validation.filter((item) => item.ready).length }),
        writePerformed: false,
        config: normalized,
        validation
    };
}
export function automatedReminderPlan(items, options = {}) {
    const watchlist = watchlistReport(items, options).findings;
    const benefit = (benefitRealizationFollowup(items, options).followups || []);
    const cadenceDays = positive(options.cadenceDays, 7);
    const reminders = [
        ...watchlist.slice(0, 10).map((item, index) => ({
            id: `watchlist-${index + 1}`,
            type: "watchlist",
            workItemId: item.id,
            title: item.title,
            cadenceDays,
            nextRun: addDays(cadenceDays),
            schedule: reminderSchedule(cadenceDays),
            owner: "process-owner",
            message: item.recommendation,
            automationPrompt: `Review watchlist item ${item.id || "unknown"} and verify owner, status, blocker, evidence, and next action.`
        })),
        ...benefit.slice(0, 10).map((item, index) => ({
            id: `benefit-${index + 1}`,
            type: "benefit-followup",
            workItemId: numberFrom(item.workItemId),
            title: stringFrom(item.title) || `Benefit follow-up ${index + 1}`,
            cadenceDays: positive(options.benefitCadenceDays, 30),
            nextRun: addDays(positive(options.benefitCadenceDays, 30)),
            schedule: reminderSchedule(positive(options.benefitCadenceDays, 30)),
            owner: stringFrom(item.owner) || "benefit-owner",
            message: stringFrom(item.recommendation) || "Verify realized benefit and evidence.",
            automationPrompt: `Review benefit realization for Work Item ${numberFrom(item.workItemId) || "unknown"} and record realized benefit evidence, owner, and exceptions.`
        }))
    ];
    return {
        ...report("Automated Reminder Plan", reminders.map((reminder) => finding(numberFrom(reminder.workItemId), stringFrom(reminder.title), 60, [stringFrom(reminder.type), `next run ${reminder.nextRun}`], "Create a Codex automation or external scheduler from this no-write plan.")), `${reminders.length} reminder recommendation(s) prepared. This tool does not schedule or send.`, { reminders: reminders.length, cadenceDays }),
        writePerformed: false,
        reminders
    };
}
export function decisionPackExport(items, evidence = [], options = {}) {
    const audience = stringFrom(options.audience) || "steering";
    const evidenceReport = report("Decision Pack Evidence", [], `${evidence.length} evidence record(s) supplied.`, { evidence: evidence.length });
    const steering = aiSteeringCommitteePack(items, [evidenceReport], options);
    const auditPack = auditDecisionLog(items, evidence);
    const handover = handoverPackGenerator(items, evidence, options);
    const rhythm = operatingRhythmPlanner(items, options);
    const pack = {
        name: stringFrom(options.name) || `${audience}-decision-pack`,
        generatedAt: new Date().toISOString(),
        audience,
        sections: {
            steering,
            auditPack,
            handover,
            operatingRhythm: rhythm
        },
        exports: ["markdown", "json"],
        imports: ["json"],
        writePerformed: false
    };
    const markdown = [
        `# ${pack.name}`,
        "",
        `Audience: ${audience}`,
        "",
        "## Steering Pack",
        steering.summary,
        "",
        "## Handover Pack",
        handover.markdown || handover.summary,
        "",
        "## Audit Pack",
        auditPack.summary,
        "",
        "## Operating Rhythm",
        rhythm.summary
    ].join("\n");
    if (options.persist === true) {
        saveNamedArtifact(DECISION_PACK_KIND, String(pack.name), { ...pack, markdown });
    }
    const manifest = decisionPackManifest(pack, markdown);
    return {
        ...report("Decision Pack Export", steering.findings.slice(0, 5), `Decision pack prepared for ${audience}.`, { items: items.length, evidence: evidence.length }),
        writePerformed: false,
        pack,
        markdown,
        manifest
    };
}
export function decisionPackImport(artifact = {}) {
    const pack = objectFrom(artifact.pack || artifact);
    const sections = objectFrom(pack.sections);
    const validation = [
        control("name", Boolean(stringFrom(pack.name)), "Decision Pack needs a stable name."),
        control("steering section", Boolean(sections.steering), "Include steering content."),
        control("handover section", Boolean(sections.handover), "Include handover content."),
        control("operating rhythm section", Boolean(sections.operatingRhythm), "Include operating rhythm content."),
        control("markdown", Boolean(stringFrom(artifact.markdown) || stringFrom(pack.markdown)), "Include Markdown export text.")
    ];
    const imported = {
        name: stringFrom(pack.name) || "imported-decision-pack",
        audience: stringFrom(pack.audience) || "unknown",
        importedAt: new Date().toISOString(),
        sections: Object.keys(sections),
        markdown: stringFrom(artifact.markdown) || stringFrom(pack.markdown),
        ready: validation.every((item) => item.ready === true)
    };
    return {
        ...report("Decision Pack Import Review", validation.filter((item) => !item.ready).map((item, index) => finding(undefined, stringFrom(item.name), 70 + index, [stringFrom(item.recommendation)], "Fix the Decision Pack artifact before importing.")), `${validation.filter((item) => item.ready).length}/${validation.length} Decision Pack import control(s) passed.`, { controls: validation.length, ready: validation.filter((item) => item.ready).length }),
        writePerformed: false,
        imported,
        validation
    };
}
function report(title, findings, summary, metrics = {}) {
    return { title, generatedAt: new Date().toISOString(), summary, findings, metrics };
}
function finding(id, title, score, signals, recommendation) {
    return { id, title, score, signals, recommendation };
}
function snapshotMetrics(items) {
    const open = items.filter((item) => !isClosed(item)).length;
    const stale = items.filter((item) => !isClosed(item) && daysSince(item.changedDate) > 21).length;
    const unassigned = items.filter((item) => !isClosed(item) && !item.assignedTo).length;
    return { items: items.length, open, closed: items.length - open, stale, unassigned };
}
function queueRisk(item) {
    if ((item.priority || 99) <= 1 || item.tags.some((tag) => /audit|compliance|security|finance/i.test(tag)))
        return "high";
    if (!item.assignedTo || daysSince(item.changedDate) > 21)
        return "medium";
    return "low";
}
function normalizeDecisionAction(value) {
    const normalized = value.toLowerCase();
    if (normalized.includes("reject") || normalized.includes("decline"))
        return "rejected";
    if (normalized.includes("override"))
        return "overridden";
    if (normalized.includes("accept") || normalized.includes("approve"))
        return "accepted";
    return normalized || "recorded";
}
function roleTitle(role) {
    if (role.includes("cio") || role.includes("executive"))
        return "CIO Portfolio Cockpit";
    if (role.includes("compliance"))
        return "Compliance Evidence Cockpit";
    if (role.includes("scrum") || role.includes("delivery"))
        return "Scrum Master Flow Cockpit";
    return "Product Owner Decision Cockpit";
}
function reportsForRole(role) {
    if (role.includes("cio") || role.includes("executive"))
        return ["steering-pack", "portfolio-fitness", "enterprise-risk", "benefit-realization"];
    if (role.includes("compliance"))
        return ["evidence-ledger", "compliance-readiness", "policy-as-code", "audit-trail"];
    if (role.includes("scrum") || role.includes("delivery"))
        return ["watchlist", "flow-mining", "approval-queue", "operating-rhythm"];
    return ["requirement-decision", "gap-analysis", "approval-queue", "decision-memory"];
}
function decisionRightsForRole(role) {
    if (role.includes("cio") || role.includes("executive"))
        return ["approve investment", "resolve escalation", "accept portfolio risk"];
    if (role.includes("compliance"))
        return ["approve evidence exception", "reject unsupported closure", "request audit pack"];
    if (role.includes("scrum") || role.includes("delivery"))
        return ["sequence cleanup", "raise blocker", "confirm delivery follow-up"];
    return ["prioritize", "accept requirement rewrite", "approve scope decision"];
}
function control(name, ready, recommendation) {
    return { name, ready, status: ready ? "ready" : "missing", recommendation };
}
function countActions(events, action) {
    return events.filter((event) => event.action === action).length;
}
function decisionPackManifest(pack, markdown) {
    const name = stringFrom(pack.name) || "decision-pack";
    return {
        schema: "rw.azureBoards.decisionPack.v1",
        name,
        generatedAt: pack.generatedAt,
        exports: [
            { format: "json", filename: `${sanitizeFilename(name)}.json`, sha256: fingerprint(pack) },
            { format: "markdown", filename: `${sanitizeFilename(name)}.md`, sha256: fingerprint(markdown) }
        ],
        imports: [{ format: "json", requiredSections: ["steering", "auditPack", "handover", "operatingRhythm"] }]
    };
}
function fingerprint(value) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
function sanitizeFilename(value) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^[._-]+|[._-]+$/g, "")
        .slice(0, 80) || "decision-pack";
}
function addDays(days) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
}
function reminderSchedule(cadenceDays) {
    return {
        cadenceDays,
        rrule: cadenceDays >= 28 ? "FREQ=MONTHLY;INTERVAL=1" : `FREQ=DAILY;INTERVAL=${Math.max(1, cadenceDays)}`,
        destination: "thread-or-external-scheduler",
        status: "suggested"
    };
}
function isClosed(item) {
    return /closed|done|removed|resolved|completed/i.test(item.state);
}
function daysSince(value) {
    if (!value)
        return 999;
    const time = Date.parse(value);
    if (!Number.isFinite(time))
        return 999;
    return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}
function objectFrom(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function arrayOfStrings(value) {
    return Array.isArray(value) ? value.map(stringFrom).filter(Boolean) : [];
}
function stringFrom(value) {
    return typeof value === "string" ? value.trim() : "";
}
function numberFrom(value) {
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(number) ? number : undefined;
}
function positive(value, fallback) {
    const number = numberFrom(value);
    return number !== undefined && number > 0 ? number : fallback;
}
