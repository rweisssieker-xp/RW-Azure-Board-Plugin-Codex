const CLOSED_STATES = new Set(["closed", "done", "completed", "resolved", "removed", "inactive"]);
const REQUIREMENT_TYPES = new Set(["requirement", "user story", "feature", "epic", "product backlog item"]);
const RISK_WORDS = /\b(block|blocked|dependency|risk|delay|urgent|audit|compliance|security|regulatory|cutover|go-live|migration)\b/i;
const VALUE_WORDS = /\b(automation|customer|finance|production|integration|compliance|revenue|saving|manual|efficiency|portal|invoice|rechnung)\b/i;
const DECISION_WORDS = /\b(decision|approved|approval|exception|waiver|defer|accepted|rejected|sign[- ]?off)\b/i;
const ERP_CRITICAL_WORDS = /\b(finance|closing|rechnung|invoice|production|warehouse|master data|stammdaten|regulatory|gudid|udi|eudamed|integration|schnittstelle|cutover|go-live)\b/i;
const BENEFIT_FIELDS = ["Custom.TargetBenefit", "Custom.ExpectedBenefit", "Custom.AnnualBenefit", "Custom.Benefit"];
const REALIZED_FIELDS = ["Custom.RealizedBenefit", "Custom.ActualBenefit", "Custom.BenefitRealized"];
const COST_FIELDS = ["Custom.Cost", "Custom.EstimatedCost", "Custom.Budget", "Microsoft.VSTS.Scheduling.OriginalEstimate"];
const EFFORT_FIELDS = ["Microsoft.VSTS.Scheduling.StoryPoints", "Microsoft.VSTS.Scheduling.Effort", "Custom.JobDuration"];
export function autonomousBoardAuditor(items, options = {}) {
    const staleDays = positive(options.staleDays, 90);
    const rows = normalizeItems(items).flatMap((item) => {
        const checks = [];
        addAudit(checks, item, "owner", isClosed(item) || Boolean(item.assignedTo), "Open item has no assigned owner.");
        addAudit(checks, item, "description", item.description.length >= 80 || !REQUIREMENT_TYPES.has(item.type.toLowerCase()), "Requirement description is not decision-grade.");
        addAudit(checks, item, "acceptance", item.acceptanceCriteria.length >= 40 || !REQUIREMENT_TYPES.has(item.type.toLowerCase()), "Acceptance criteria are missing or weak.");
        addAudit(checks, item, "stale", isClosed(item) || daysSince(item.changedDate) < staleDays, `Open item is stale beyond ${staleDays} days.`);
        addAudit(checks, item, "benefit", !isClosed(item) || realizedBenefit(item) > 0 || expectedBenefit(item) < 25_000, "Closed item has material benefit but no realized benefit evidence.");
        return checks;
    });
    const failed = rows.filter((row) => row.status === "fail");
    const findings = failed.map((row) => finding(Number(row.id), String(row.title), 75, [`check ${row.check}`, String(row.reason)], "Fix the audit gap or record an explicit exception before the next governance review."));
    return { ...report("Autonomous Board Auditor", findings, `${failed.length} audit finding(s) found across ${rows.length} checks.`, { checks: rows.length, failedChecks: failed.length }), writePerformed: false, auditRows: rows };
}
export function requirementRewriteStudio(items) {
    const rewrites = normalizeItems(items)
        .filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase()))
        .map((item) => {
        const domain = domainFor(item);
        const description = [
            `Problem: ${item.description ? firstSentence(item.description) : "The current requirement does not state the business problem clearly."}`,
            `Goal: Deliver a measurable ${domain} outcome with a named owner and verifiable evidence.`,
            `Business value: Reduce manual effort, risk, or delay; expected annual value ${Math.round(expectedBenefit(item))} EUR.`,
            "Scope: Implement only the behavior needed to satisfy the stated acceptance criteria.",
            "Non-goals: Do not expand scope without a new approved business case."
        ].join("\n\n");
        const acceptanceCriteria = [
            `- Given the ${domain} owner reviews the requirement, when implementation is complete, then the expected outcome is demonstrably met.`,
            "- Required evidence is attached or linked before closure.",
            "- Error, exception, and rollback behavior is documented where relevant.",
            "- Benefit owner confirms whether value realization tracking is needed."
        ].join("\n");
        return {
            id: item.id,
            title: item.title,
            suggestedDescription: description,
            suggestedAcceptanceCriteria: acceptanceCriteria,
            patchPreview: [
                { op: item.description ? "replace" : "add", path: "/fields/System.Description", value: description },
                { op: item.acceptanceCriteria ? "replace" : "add", path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria", value: acceptanceCriteria }
            ],
            writePerformed: false
        };
    });
    const findings = rewrites.map((rewrite) => finding(Number(rewrite.id), String(rewrite.title), 70, ["rewrite patch preview prepared"], "Review the proposed Description and Acceptance Criteria before applying any update."));
    return { ...report("AI Requirement Rewrite Studio", findings, `${rewrites.length} requirement rewrite preview(s) prepared.`, { rewrites: rewrites.length }), writePerformed: false, rewrites };
}
export function decisionMeetingCopilot(items, evidence = []) {
    const normalized = normalizeItems(items);
    const candidates = normalized
        .filter((item) => !isClosed(item))
        .map((item) => {
        const score = scoreDecisionNeed(item);
        return {
            id: item.id,
            title: item.title,
            decisionAsk: decisionAsk(item),
            owner: item.assignedTo || "unassigned",
            score,
            evidence: evidenceFor(item, evidence).length
        };
    })
        .filter((entry) => entry.score > 25)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);
    const findings = candidates.map((entry) => finding(entry.id, entry.title, entry.score, [`owner ${entry.owner}`, `evidence records ${entry.evidence}`], entry.decisionAsk));
    const minutesDraft = ["# Decision Meeting Draft", "", ...candidates.map((entry) => `- #${entry.id} ${entry.title}: ${entry.decisionAsk} Owner: ${entry.owner}.`), "", "_Draft only. No Azure Boards write was performed._"].join("\n");
    return { ...report("Decision Meeting Copilot", findings, `${candidates.length} decision agenda item(s) prepared.`, { agendaItems: candidates.length }), writePerformed: false, agenda: candidates, minutesDraft };
}
export function cleanupCampaignManager(items, options = {}) {
    const campaignName = stringFrom(options.name) || "Board cleanup campaign";
    const target = stringFrom(options.target) || "stale-low-value";
    const normalized = normalizeItems(items);
    const actions = normalized
        .filter((item) => campaignMatch(item, target))
        .map((item) => ({
        id: item.id,
        title: item.title,
        action: isClosed(item) ? "verify-evidence" : "review-close-or-rework",
        rationale: campaignRationale(item, target),
        patchPreview: isClosed(item) ? [] : [{ op: "add", path: "/fields/System.Tags", value: mergeTags(item.tags, "Cleanup Review") }],
        writePerformed: false
    }));
    const findings = actions.map((action) => finding(Number(action.id), String(action.title), action.patchPreview.length ? 70 : 40, [String(action.action), String(action.rationale)], "Review campaign action and approve explicit writes separately."));
    return { ...report("Board Cleanup Campaign Manager", findings, `${actions.length} campaign action(s) planned for ${campaignName}.`, { campaignActions: actions.length }), writePerformed: false, campaign: { name: campaignName, target, approvalRequired: true }, actions };
}
export function financialBacklogLedger(items, options = {}) {
    const defaultDailyCost = positive(options.defaultDailyCost, 250);
    const ledger = normalizeItems(items).map((item) => {
        const expected = expectedBenefit(item);
        const cost = implementationCost(item, options);
        const delayCost = isClosed(item) ? 0 : Math.round(defaultDailyCost * Math.max(1, 6 - priority(item)) * Math.min(daysSince(item.changedDate) || 1, 120));
        const realized = realizedBenefit(item);
        const netValue = expected + realized - cost - delayCost;
        return { id: item.id, title: item.title, state: item.state, expectedBenefit: Math.round(expected), realizedBenefit: Math.round(realized), implementationCost: Math.round(cost), delayCost, netValue: Math.round(netValue) };
    }).sort((a, b) => Number(b.netValue) - Number(a.netValue));
    const findings = ledger.map((row) => finding(Number(row.id), String(row.title), Math.min(100, Math.abs(Number(row.netValue)) / 1000), [`net value ${row.netValue}`, `expected ${row.expectedBenefit}`, `cost ${row.implementationCost}`, `delay ${row.delayCost}`], Number(row.netValue) < 0 ? "Challenge or close unless a stronger business case exists." : "Protect capacity if evidence and owner are valid."));
    return { ...report("Financial Backlog Ledger", findings, `${ledger.length} Work Item(s) translated into financial backlog ledger rows.`, { totalNetValue: ledger.reduce((sum, row) => sum + Number(row.netValue), 0) }), writePerformed: false, ledger };
}
export function requirementConfidenceScore(items) {
    const scores = normalizeItems(items)
        .filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase()))
        .map((item) => {
        const score = confidenceScore(item);
        const status = score >= 75 ? "ready" : score >= 45 ? "needs clarification" : "not investable";
        return { id: item.id, title: item.title, confidenceScore: score, status, signals: confidenceSignals(item) };
    });
    const findings = scores.map((row) => finding(Number(row.id), String(row.title), Number(row.confidenceScore), row.signals, String(row.status) === "ready" ? "Requirement is decision-ready; keep evidence current." : "Clarify evidence, owner, value, and acceptance criteria before investment."));
    return { ...report("Requirement Confidence Score", findings, `${scores.length} requirement confidence score(s) generated.`, { scoredRequirements: scores.length }), writePerformed: false, scores };
}
export function dependencyBlockerGraph(items, comments = []) {
    const normalized = normalizeItems(items);
    const nodes = normalized.map((item) => ({ id: `wi:${item.id}`, label: `#${item.id} ${item.title}`, kind: "workItem", state: item.state, owner: item.assignedTo || "" }));
    const edges = [];
    for (const item of normalized) {
        if (item.parentId)
            edges.push({ from: `wi:${item.parentId}`, to: `wi:${item.id}`, relation: "parent-child" });
        if (RISK_WORDS.test(textFor(item)))
            edges.push({ from: `risk:${item.id}`, to: `wi:${item.id}`, relation: "risk-signal" });
        for (const link of item.links)
            edges.push({ from: `wi:${item.id}`, to: `link:${item.id}:${link}`, relation: "linked-artifact" });
    }
    for (const comment of comments) {
        const id = numberFrom(comment.workItemId) ?? numberFrom(comment.id);
        if (id && RISK_WORDS.test(evidenceText(comment)))
            edges.push({ from: `comment:${id}`, to: `wi:${id}`, relation: "comment-blocker" });
    }
    const blockerIds = new Set(edges.filter((edge) => String(edge.relation).includes("risk") || String(edge.relation).includes("blocker")).map((edge) => String(edge.to).replace("wi:", "")));
    const findings = normalized.filter((item) => blockerIds.has(String(item.id))).map((item) => finding(item.id, item.title, 80, ["dependency/blocker graph signal"], "Assign blocker owner and document unblock path."));
    return { ...report("AI Dependency & Blocker Graph", findings, `${nodes.length} node(s) and ${edges.length} edge(s) generated.`, { nodes: nodes.length, edges: edges.length, blockerItems: findings.length }), writePerformed: false, graph: { nodes, edges } };
}
export function processOwnerControlTower(items, policy = {}) {
    const normalized = normalizeItems(items);
    const grouped = groupBy(normalized, (item) => item.areaPath || "Unknown");
    const teams = Object.entries(grouped).map(([area, areaItems]) => {
        const open = areaItems.filter((item) => !isClosed(item));
        const gaps = areaItems.filter((item) => !item.assignedTo || !evidenceSignals(item).length || (REQUIREMENT_TYPES.has(item.type.toLowerCase()) && !item.acceptanceCriteria)).length;
        const score = Math.max(0, 100 - Math.round((gaps / Math.max(areaItems.length, 1)) * 100) - open.filter((item) => daysSince(item.changedDate) > positive(policy.staleDays, 60)).length * 3);
        return { areaPath: area, governanceScore: score, totalItems: areaItems.length, openItems: open.length, governanceGaps: gaps };
    }).sort((a, b) => Number(a.governanceScore) - Number(b.governanceScore));
    const findings = teams.map((team) => finding(0, String(team.areaPath), 100 - Number(team.governanceScore), [`score ${team.governanceScore}`, `${team.governanceGaps} governance gaps`, `${team.openItems} open items`], "Review team policy gaps, stale work, and exception handling."));
    return { ...report("Process Owner Control Tower", findings, `${teams.length} Area Path control tower row(s) generated.`, { teams: teams.length }), writePerformed: false, teams };
}
export function migrationCutoverReadiness(items, options = {}) {
    const normalized = normalizeItems(items);
    const mustHave = normalized.filter((item) => priority(item) <= 2 || ERP_CRITICAL_WORDS.test(textFor(item)));
    const openCritical = mustHave.filter((item) => !isClosed(item));
    const missingEvidence = mustHave.filter((item) => !evidenceSignals(item).length);
    const blocking = normalized.filter((item) => RISK_WORDS.test(textFor(item)) && !isClosed(item));
    const readinessScore = Math.max(0, 100 - openCritical.length * 8 - missingEvidence.length * 6 - blocking.length * 10);
    const status = readinessScore >= 80 ? "go" : readinessScore >= 55 ? "conditional-go" : "no-go";
    const findings = [...openCritical, ...missingEvidence, ...blocking]
        .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
        .map((item) => finding(item.id, item.title, 100 - readinessScore + priority(item) * 3, cutoverSignals(item), "Resolve or explicitly accept this cutover risk before go-live."));
    return { ...report("Migration Cutover Readiness", findings, `Cutover readiness is ${status} with score ${readinessScore}/100.`, { readinessScore, openCritical: openCritical.length, missingEvidence: missingEvidence.length, blockers: blocking.length }), writePerformed: false, readiness: { status, readinessScore, assessedItems: normalized.length, goNoGo: status } };
}
export function aiExceptionRegister(items, evidence = []) {
    const exceptions = normalizeItems(items).flatMap((item) => {
        const texts = [textFor(item), ...evidenceFor(item, evidence).map(evidenceText)];
        if (!texts.some((text) => DECISION_WORDS.test(text) && /exception|waiver|defer|accepted/i.test(text)))
            return [];
        return [{
                id: item.id,
                title: item.title,
                owner: item.assignedTo || "unassigned",
                status: isClosed(item) ? "closed-exception" : "open-exception",
                risk: RISK_WORDS.test(textFor(item)) ? "high" : "medium",
                expiryRecommendation: "Set an explicit expiry date or review cadence."
            }];
    });
    const findings = exceptions.map((entry) => finding(Number(entry.id), String(entry.title), entry.risk === "high" ? 85 : 60, [`owner ${entry.owner}`, `status ${entry.status}`, `risk ${entry.risk}`], "Confirm exception owner, rationale, expiry, and compensating control."));
    return { ...report("AI Exception Register", findings, `${exceptions.length} exception or waiver candidate(s) found.`, { exceptions: exceptions.length }), writePerformed: false, exceptions };
}
export function benefitRealizationFollowup(items, options = {}) {
    const lagDays = positive(options.realizationLagDays, 30);
    const followups = normalizeItems(items)
        .filter((item) => isClosed(item) && expectedBenefit(item) >= 25_000 && daysSince(item.changedDate) >= lagDays)
        .map((item) => ({
        id: item.id,
        title: item.title,
        expectedBenefit: Math.round(expectedBenefit(item)),
        realizedBenefit: Math.round(realizedBenefit(item)),
        ageSinceClosure: daysSince(item.changedDate),
        action: realizedBenefit(item) > 0 ? "validate-realization" : "request-realized-benefit"
    }));
    const findings = followups.map((entry) => finding(Number(entry.id), String(entry.title), Number(entry.expectedBenefit) / 1000, [`expected ${entry.expectedBenefit}`, `realized ${entry.realizedBenefit}`, `closed ${entry.ageSinceClosure} days ago`], "Ask the benefit owner to update realized benefit or re-baseline the case."));
    return { ...report("Benefit Realization Follow-up Bot", findings, `${followups.length} benefit follow-up(s) due after closure.`, { followups: followups.length }), writePerformed: false, followups };
}
export function operatingRhythmPlanner(items, options = {}) {
    const normalized = normalizeItems(items);
    const staleDays = positive(options.staleDays, 30);
    const highRisk = normalized.filter((item) => !isClosed(item) && (RISK_WORDS.test(textFor(item)) || priority(item) <= 2));
    const weakRequirements = normalized.filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase()) && confidenceScore(item) < 45);
    const benefitFollowups = normalized.filter((item) => isClosed(item) && expectedBenefit(item) >= 25_000 && realizedBenefit(item) === 0);
    const cadence = [
        { cadence: "daily", meeting: "Delivery risk standup", targetItems: highRisk.slice(0, 10).map((item) => item.id), decision: "Unblock, escalate, or accept risk." },
        { cadence: "weekly", meeting: "Requirement evidence clinic", targetItems: weakRequirements.slice(0, 15).map((item) => item.id), decision: "Rewrite, park, or close weak Requirements." },
        { cadence: "biweekly", meeting: "Process owner governance review", targetItems: normalized.filter((item) => !isClosed(item) && daysSince(item.changedDate) > staleDays).slice(0, 20).map((item) => item.id), decision: "Resolve stale work and policy gaps." },
        { cadence: "monthly", meeting: "Benefit realization review", targetItems: benefitFollowups.slice(0, 20).map((item) => item.id), decision: "Confirm realized value or re-baseline business case." },
        { cadence: "quarterly", meeting: "Portfolio fitness review", targetItems: normalized.filter((item) => expectedBenefit(item) < implementationCost(item, options) && !isClosed(item)).slice(0, 20).map((item) => item.id), decision: "Divest, bundle, or reprioritize low-fitness work." }
    ];
    const findings = cadence
        .filter((entry) => entry.targetItems.length)
        .map((entry) => finding(0, String(entry.meeting), Math.min(100, entry.targetItems.length * 12), [`cadence ${entry.cadence}`, `${entry.targetItems.length} target item(s)`], String(entry.decision)));
    return { ...report("Operating Rhythm Planner", findings, `${cadence.length} governance cadence block(s) prepared.`, { cadenceBlocks: cadence.length, activeBlocks: findings.length }), writePerformed: false, cadence };
}
export function okrAlignmentScorer(items, options = {}) {
    const objectives = arrayOfStrings(options.objectives).length ? arrayOfStrings(options.objectives) : ["finance automation", "customer experience", "regulatory compliance", "integration stability", "operational efficiency"];
    const alignments = normalizeItems(items).map((item) => {
        const text = textFor(item);
        const matched = objectives.filter((objective) => objective.toLowerCase().split(/\s+/).some((word) => word.length > 3 && text.includes(word)));
        const score = Math.min(100, matched.length * 35 + (expectedBenefit(item) >= 50_000 ? 20 : 0) + (priority(item) <= 2 ? 10 : 0));
        const status = score >= 70 ? "aligned" : score >= 35 ? "partial" : "unaligned";
        return { id: item.id, title: item.title, status, alignmentScore: score, objectives: matched, expectedBenefit: Math.round(expectedBenefit(item)) };
    }).sort((a, b) => Number(a.alignmentScore) - Number(b.alignmentScore));
    const findings = alignments.filter((entry) => entry.status !== "aligned").map((entry) => finding(Number(entry.id), String(entry.title), 100 - Number(entry.alignmentScore), [`status ${entry.status}`, `objectives ${entry.objectives.join(", ") || "none"}`], "Clarify strategic objective or remove from active portfolio."));
    return { ...report("OKR Alignment Scorer", findings, `${alignments.length} Work Item(s) scored against ${objectives.length} objective(s).`, { assessedItems: alignments.length, objectives: objectives.length, unaligned: alignments.filter((entry) => entry.status === "unaligned").length }), writePerformed: false, alignments };
}
export function complianceReadinessReview(items, policy = {}) {
    const regulatoryOnly = policy.regulatoryOnly !== false;
    const candidates = normalizeItems(items).filter((item) => !regulatoryOnly || /regulatory|compliance|audit|gudid|udi|eudamed|security|privacy/i.test(textFor(item)));
    const controls = candidates.flatMap((item) => [
        control(item, "owner", Boolean(item.assignedTo), "Missing accountable owner."),
        control(item, "acceptance", item.acceptanceCriteria.length >= 40, "Missing testable acceptance criteria."),
        control(item, "evidence", evidenceSignals(item).length > 0, "Missing audit or validation evidence."),
        control(item, "exception", isClosed(item) || !RISK_WORDS.test(textFor(item)) || DECISION_WORDS.test(item.description), "Open risk has no decision or exception rationale.")
    ]);
    const failed = controls.filter((entry) => entry.status === "fail");
    const findings = failed.map((entry) => finding(Number(entry.id), String(entry.title), 80, [`control ${entry.control}`, String(entry.reason)], "Close the compliance evidence gap or document an explicit exception."));
    return { ...report("Compliance Readiness Review", findings, `${failed.length} failed control(s) across ${controls.length} compliance checks.`, { controls: controls.length, failedControls: failed.length, assessedItems: candidates.length }), writePerformed: false, controls };
}
export function handoverPackGenerator(items, evidence = [], options = {}) {
    const role = stringFrom(options.role) || "Process Owner";
    const normalized = normalizeItems(items);
    const critical = normalized.filter((item) => !isClosed(item) && (priority(item) <= 2 || RISK_WORDS.test(textFor(item)))).slice(0, 10);
    const decisions = normalized.filter((item) => DECISION_WORDS.test(textFor(item)) || evidenceFor(item, evidence).some((entry) => DECISION_WORDS.test(evidenceText(entry)))).slice(0, 10);
    const weak = normalized.filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase()) && confidenceScore(item) < 45).slice(0, 10);
    const sections = [
        { title: "Open critical work", itemIds: critical.map((item) => item.id) },
        { title: "Recent decisions and exceptions", itemIds: decisions.map((item) => item.id) },
        { title: "Weak requirements needing clarification", itemIds: weak.map((item) => item.id) }
    ];
    const markdown = [
        `# ${role} Handover Pack`,
        "",
        "## Open Critical Work",
        ...critical.map((item) => `- #${item.id} ${item.title}: ${decisionAsk(item)}`),
        "",
        "## Decisions And Exceptions",
        ...decisions.map((item) => `- #${item.id} ${item.title}: owner ${item.assignedTo || "unassigned"}`),
        "",
        "## Weak Requirements",
        ...weak.map((item) => `- #${item.id} ${item.title}: confidence ${confidenceScore(item)}/100`),
        "",
        "_Generated from board evidence only. No Azure Boards write was performed._"
    ].join("\n");
    const findings = [...critical, ...weak].filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index).map((item) => finding(item.id, item.title, RISK_WORDS.test(textFor(item)) ? 85 : 60, [`owner ${item.assignedTo || "missing"}`, `confidence ${confidenceScore(item)}`], "Include this item in the handover discussion."));
    return { ...report("Handover Pack Generator", findings, `${sections.length} handover section(s) generated for ${role}.`, { sections: sections.length }), writePerformed: false, markdown, sections };
}
export function portfolioFitnessIndex(items, options = {}) {
    const normalized = normalizeItems(items);
    const open = normalized.filter((item) => !isClosed(item));
    const stale = open.filter((item) => daysSince(item.changedDate) > positive(options.staleDays, 60));
    const ownerGaps = open.filter((item) => !item.assignedTo);
    const weakRequirements = normalized.filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase()) && confidenceScore(item) < 45);
    const totalBenefit = normalized.reduce((sum, item) => sum + expectedBenefit(item), 0);
    const totalCost = normalized.reduce((sum, item) => sum + implementationCost(item, options), 0);
    const valueCostRatio = totalCost ? totalBenefit / totalCost : 0;
    const score = Math.max(0, Math.min(100, Math.round(55 + Math.min(30, valueCostRatio * 10) - stale.length * 3 - ownerGaps.length * 2 - weakRequirements.length * 2)));
    const fitness = {
        score,
        status: score >= 75 ? "healthy" : score >= 50 ? "strained" : "critical",
        openItems: open.length,
        staleItems: stale.length,
        ownerGaps: ownerGaps.length,
        weakRequirements: weakRequirements.length,
        totalExpectedBenefit: Math.round(totalBenefit),
        totalEstimatedCost: Math.round(totalCost),
        valueCostRatio: Number(valueCostRatio.toFixed(2))
    };
    const findings = [
        ...stale.map((item) => finding(item.id, item.title, 70, [`stale ${daysSince(item.changedDate)} days`], "Resolve, re-baseline, or close stale portfolio work.")),
        ...ownerGaps.map((item) => finding(item.id, item.title, 65, ["missing owner"], "Assign accountable owner or remove from active portfolio.")),
        ...weakRequirements.map((item) => finding(item.id, item.title, 60, [`confidence ${confidenceScore(item)}`], "Improve requirement quality before further spend."))
    ];
    return { ...report("Portfolio Fitness Index", findings, `Portfolio fitness is ${fitness.status} with score ${score}/100.`, { portfolioFitness: score, openItems: open.length, staleItems: stale.length, ownerGaps: ownerGaps.length, weakRequirements: weakRequirements.length }), writePerformed: false, fitness };
}
function normalizeItems(items) {
    return items.map((raw, index) => {
        const record = objectFrom(raw);
        const fields = objectFrom(record.fields);
        const id = numberFrom(record.id) ?? numberFrom(fields["System.Id"]) ?? index + 1;
        return {
            id,
            type: stringFrom(record.type) || stringFrom(fields["System.WorkItemType"]) || "Work Item",
            title: stringFrom(record.title) || stringFrom(fields["System.Title"]) || `Work Item ${id}`,
            state: stringFrom(record.state) || stringFrom(fields["System.State"]) || "",
            assignedTo: identity(record.assignedTo) || identity(fields["System.AssignedTo"]),
            priority: numberFrom(record.priority) ?? numberFrom(fields["Microsoft.VSTS.Common.Priority"]),
            tags: tagsFrom(record.tags ?? fields["System.Tags"]),
            createdDate: stringFrom(record.createdDate) || stringFrom(fields["System.CreatedDate"]),
            changedDate: stringFrom(record.changedDate) || stringFrom(fields["System.ChangedDate"]),
            areaPath: stringFrom(record.areaPath) || stringFrom(fields["System.AreaPath"]),
            iterationPath: stringFrom(record.iterationPath) || stringFrom(fields["System.IterationPath"]),
            parentId: numberFrom(record.parentId) ?? parentIdFromRelations(record),
            description: stripHtml(stringFrom(record.description) || stringFrom(fields["System.Description"])),
            acceptanceCriteria: stripHtml(stringFrom(record.acceptanceCriteria) || stringFrom(fields["Microsoft.VSTS.Common.AcceptanceCriteria"])),
            attachments: attachmentNames(record),
            links: linkNames(record),
            raw: record
        };
    });
}
function addAudit(rows, item, check, passed, reason) {
    rows.push({ id: item.id, title: item.title, check, status: passed ? "pass" : "fail", reason: passed ? "ok" : reason });
}
function control(item, name, passed, reason) {
    return { id: item.id, title: item.title, control: name, status: passed ? "pass" : "fail", reason: passed ? "ok" : reason };
}
function confidenceScore(item) {
    return Math.min(100, (item.description.length >= 120 ? 25 : item.description.length >= 60 ? 12 : 0) + (item.acceptanceCriteria.length >= 40 ? 25 : 0) + (item.assignedTo ? 15 : 0) + (evidenceSignals(item).length ? 20 : 0) + (expectedBenefit(item) >= 25_000 ? 15 : 0));
}
function confidenceSignals(item) {
    return [`description ${item.description.length} chars`, `acceptance ${item.acceptanceCriteria.length} chars`, item.assignedTo ? `owner ${item.assignedTo}` : "missing owner", `${evidenceSignals(item).length} evidence signal(s)`, `expected benefit ${Math.round(expectedBenefit(item))}`];
}
function campaignMatch(item, target) {
    if (target.includes("low-wsjf") || target.includes("low-value"))
        return !isClosed(item) && expectedBenefit(item) < 30_000;
    if (target.includes("missing-description"))
        return REQUIREMENT_TYPES.has(item.type.toLowerCase()) && item.description.length < 80;
    if (target.includes("orphan") || target.includes("task"))
        return item.type.toLowerCase() === "task" && !item.parentId;
    if (target.includes("closed-evidence"))
        return isClosed(item) && !evidenceSignals(item).length;
    return !isClosed(item) && (daysSince(item.changedDate) > 90 || !item.assignedTo || item.description.length < 80);
}
function campaignRationale(item, target) {
    return `${target}: ${item.type} #${item.id}, state ${item.state}, owner ${item.assignedTo || "missing"}, changed ${daysSince(item.changedDate)} days ago.`;
}
function decisionAsk(item) {
    if (!item.assignedTo)
        return "Assign accountable owner or park the work.";
    if (RISK_WORDS.test(textFor(item)))
        return "Decide escalation, dependency owner, or risk acceptance.";
    if (confidenceScore(item) < 45)
        return "Decide whether to rework or close due to weak evidence.";
    if (expectedBenefit(item) < implementationCost(item, {}))
        return "Decide whether the business case justifies further spend.";
    return "Confirm priority, target date, and next delivery step.";
}
function scoreDecisionNeed(item) {
    let score = 0;
    if (!item.assignedTo)
        score += 25;
    if (RISK_WORDS.test(textFor(item)))
        score += 30;
    if (confidenceScore(item) < 45)
        score += 25;
    if (daysSince(item.changedDate) > 60)
        score += 20;
    if (priority(item) <= 2)
        score += 10;
    return Math.min(100, score);
}
function cutoverSignals(item) {
    const signals = [`priority ${priority(item)}`, `state ${item.state}`];
    if (ERP_CRITICAL_WORDS.test(textFor(item)))
        signals.push("ERP critical domain");
    if (!evidenceSignals(item).length)
        signals.push("missing evidence");
    if (RISK_WORDS.test(textFor(item)))
        signals.push("risk/blocker language");
    return signals;
}
function expectedBenefit(item) {
    return firstNumber(item, BENEFIT_FIELDS) ?? Math.max(8_000, valueScore(item) * 1_200);
}
function realizedBenefit(item) {
    return firstNumber(item, REALIZED_FIELDS) ?? 0;
}
function implementationCost(item, options) {
    const explicit = firstNumber(item, COST_FIELDS);
    if (explicit !== undefined)
        return explicit;
    const effort = firstNumber(item, EFFORT_FIELDS);
    if (effort !== undefined)
        return effort * positive(options.defaultStoryPointCost, 1_500);
    const base = positive(options.defaultItemCost, 12_000);
    if (/epic/i.test(item.type))
        return base * 6;
    if (/feature/i.test(item.type))
        return base * 3;
    if (/requirement|story|pbi/i.test(item.type))
        return base * 1.5;
    return base;
}
function valueScore(item) {
    const explicit = firstNumber(item, ["Custom.BusinessValue", "Microsoft.VSTS.Common.BusinessValue", "Custom.CostOfDelay"]);
    const priorityPart = (6 - Math.min(priority(item), 5)) * 8;
    const keywordBoost = VALUE_WORDS.test(textFor(item)) ? 25 : 0;
    const criticalBoost = ERP_CRITICAL_WORDS.test(textFor(item)) ? 20 : 0;
    return Math.min(100, Math.round((explicit ?? 0) * 8 + priorityPart + keywordBoost + criticalBoost));
}
function evidenceSignals(item) {
    const signals = [];
    if (item.description.length >= 120)
        signals.push("description evidence");
    if (item.acceptanceCriteria.length >= 40)
        signals.push("acceptance criteria");
    if (item.attachments.length)
        signals.push(`${item.attachments.length} attachment(s)`);
    if (item.links.length)
        signals.push(`${item.links.length} linked artifact(s)`);
    if (item.tags.some((tag) => /evidence|audit|approved|validated|verified/i.test(tag)))
        signals.push("evidence tag");
    if (DECISION_WORDS.test(item.description))
        signals.push("decision language");
    return signals;
}
function evidenceFor(item, evidence) {
    return evidence.filter((entry) => (numberFrom(entry.workItemId) ?? numberFrom(entry.id)) === item.id);
}
function domainFor(item) {
    const text = textFor(item);
    if (/finance|rechnung|invoice|closing/i.test(text))
        return "Finance";
    if (/production|fertigung|warehouse|lager/i.test(text))
        return "Operations";
    if (/regulatory|audit|gudid|udi|eudamed|compliance/i.test(text))
        return "Regulatory";
    if (/integration|schnittstelle|api|ssis/i.test(text))
        return "Integration";
    if (/customer|kunde|portal|crm/i.test(text))
        return "Customer";
    return "business process";
}
function firstNumber(item, fields) {
    const sourceFields = objectFrom(item.raw.fields);
    for (const field of fields) {
        const value = numberFrom(sourceFields[field]) ?? numberFrom(item.raw[field]);
        if (value !== undefined)
            return value;
    }
    return undefined;
}
function finding(id, title, score, signals, recommendation) {
    const bounded = Math.round(Math.max(0, Math.min(100, score)));
    return { id: id || undefined, title: id ? `#${id} ${title}` : title, score: bounded, severity: bounded >= 85 ? "critical" : bounded >= 65 ? "high" : bounded >= 35 ? "medium" : "low", signals, recommendation };
}
function report(title, findings, summary, metrics = {}) {
    return {
        title,
        generatedAt: new Date().toISOString(),
        summary,
        findings: findings.sort((a, b) => (b.score || 0) - (a.score || 0)),
        metrics: { findings: findings.length, ...metrics },
        nextActions: ["Use findings as decision support only.", "Keep writes behind explicit preview/apply confirmation.", "Record owners, evidence, and exception rationale for auditability."]
    };
}
function groupBy(items, key) {
    return items.reduce((acc, item) => {
        const value = key(item);
        acc[value] ||= [];
        acc[value].push(item);
        return acc;
    }, {});
}
function priority(item) {
    return item.priority && item.priority > 0 ? item.priority : 3;
}
function isClosed(item) {
    return CLOSED_STATES.has(item.state.toLowerCase());
}
function daysSince(value) {
    if (!value)
        return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? Math.max(0, Math.floor((Date.now() - time) / 86_400_000)) : 0;
}
function textFor(item) {
    return `${item.title} ${item.description} ${item.acceptanceCriteria} ${item.tags.join(" ")} ${item.areaPath || ""} ${item.iterationPath || ""}`.toLowerCase();
}
function parentIdFromRelations(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    const relation = relations.find((entry) => entry.rel === "System.LinkTypes.Hierarchy-Reverse" || objectFrom(entry.attributes).name === "Parent");
    const match = stringFrom(relation?.url).match(/\/(\d+)$/);
    return match ? Number(match[1]) : undefined;
}
function attachmentNames(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    return relations.filter((relation) => relation.rel === "AttachedFile").map((relation) => stringFrom(objectFrom(relation.attributes).name) || "attachment");
}
function linkNames(raw) {
    const relations = Array.isArray(raw.relations) ? raw.relations : [];
    return relations.filter((relation) => relation.rel !== "AttachedFile" && relation.rel !== "System.LinkTypes.Hierarchy-Reverse").map((relation) => stringFrom(objectFrom(relation.attributes).name) || stringFrom(relation.rel) || "link");
}
function mergeTags(tags, tag) {
    return Array.from(new Set([...tags, tag].filter(Boolean))).join("; ");
}
function evidenceText(record) {
    const fields = objectFrom(record.fields);
    return [record.text, record.comment, record.message, record.summary, record.title, fields["System.History"]].map(stringFrom).filter(Boolean).join(" ");
}
function objectFrom(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function numberFrom(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}
function stringFrom(value) {
    return typeof value === "string" ? value.trim() : "";
}
function arrayOfStrings(value) {
    return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}
function identity(value) {
    if (typeof value === "string" && value.trim())
        return value.trim();
    const object = objectFrom(value);
    return stringFrom(object.displayName) || stringFrom(object.uniqueName) || stringFrom(object.name) || undefined;
}
function tagsFrom(value) {
    if (Array.isArray(value))
        return value.map((entry) => String(entry).trim()).filter(Boolean);
    return stringFrom(value).split(";").map((entry) => entry.trim()).filter(Boolean);
}
function stripHtml(value) {
    return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function firstSentence(value) {
    const clean = stripHtml(value);
    const match = clean.match(/^(.{1,220}?)(?:[.!?]\s|$)/);
    return (match ? match[1] : clean.slice(0, 220)).trim();
}
function positive(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
