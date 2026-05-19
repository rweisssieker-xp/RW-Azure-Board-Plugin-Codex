import { buildFieldPatch } from "./azureDevOps.js";
import { briefExport as baseBriefExport } from "./briefExport.js";
import {
  createProcessBaseline as baseCreateProcessBaseline,
  processDriftDetection as baseProcessDriftDetection,
  type ProcessBaseline
} from "./baselineAnalytics.js";
import {
  actionPlan as baseActionPlan,
  watchlistReport as baseWatchlistReport
} from "./operationalAnalytics.js";
import {
  capacityForecast as baseCapacityForecast,
  costOfDelayRadar as baseCostOfDelayRadar,
  processSimulator as baseProcessSimulator
} from "./strategicAnalytics.js";
import type { Finding, Report, WorkItemSummary } from "./types.js";

const CLOSED_STATES = new Set(["closed", "done", "removed", "resolved", "completed"]);
const BLOCKER_WORDS = ["block", "blocked", "impediment", "waiting", "dependency", "on hold"];
const DECISION_WORDS = ["decision", "decide", "approval", "sign-off", "clarify", "open question"];
const RISK_WORDS = ["risk", "issue", "delay", "late", "miss", "escalate", "urgent"];
const CUSTOMER_WORDS = ["customer", "client", "user", "production", "prod", "outage", "impact"];
const QUALITY_FIELDS = ["title", "description", "acceptanceCriteria"] as const;

export function deliveryRiskRadar(items: WorkItemSummary[]): Report {
  const findings = items
    .map((item) => {
      const signals: string[] = [];
      let score = 0;
      const age = daysSince(item.createdDate);
      const stale = daysSince(item.changedDate);
      if (!isClosed(item) && age > 30) {
        score += 25;
        signals.push(`open for ${age} days`);
      }
      if (!isClosed(item) && stale > 10) {
        score += 25;
        signals.push(`no update for ${stale} days`);
      }
      if (!item.assignedTo && !isClosed(item)) {
        score += 20;
        signals.push("no assignee");
      }
      if ((item.priority || 99) <= 2 && !isClosed(item)) {
        score += 15;
        signals.push(`high priority ${item.priority}`);
      }
      if (hasAny(item, BLOCKER_WORDS)) {
        score += 25;
        signals.push("blocker/dependency language detected");
      }
      return findingForItem(item, Math.min(score, 100), signals, "Review owner, blocker status, and next dated action.");
    })
    .filter((finding) => (finding.score || 0) > 0)
    .sort(byScoreDesc)
    .slice(0, 10);

  return report("AI Delivery Risk Radar", findings, {
    summary: `${findings.length} risky Work Items need delivery attention.`,
    nextActions: ["Confirm owner for unassigned risks.", "Update stale high-priority items.", "Escalate dependency blockers."]
  });
}

export function milestoneForecast(items: WorkItemSummary[]): Report {
  const open = items.filter((item) => !isClosed(item));
  const stale = open.filter((item) => daysSince(item.changedDate) > 7);
  const blocked = open.filter((item) => hasAny(item, BLOCKER_WORDS));
  const doneRate = items.length ? (items.length - open.length) / items.length : 0;
  const riskScore = Math.min(100, Math.round((1 - doneRate) * 55 + (stale.length / Math.max(open.length, 1)) * 25 + blocked.length * 5));
  const confidence = riskScore > 70 ? "low" : riskScore > 40 ? "medium" : "high";
  return report(
    "Milestone Confidence Forecast",
    [
      {
        title: `Milestone confidence is ${confidence}`,
        score: 100 - riskScore,
        severity: riskScore > 70 ? "high" : riskScore > 40 ? "medium" : "low",
        signals: [`${open.length} open items`, `${stale.length} stale items`, `${blocked.length} possible blockers`, `${Math.round(doneRate * 100)}% closed/resolved`],
        recommendation: "Review scope, unblock stale items, and validate remaining capacity before committing externally."
      }
    ],
    { metrics: { openItems: open.length, staleItems: stale.length, blockerSignals: blocked.length, confidence } }
  );
}

export function scopeCreepDetector(current: WorkItemSummary[], previous: WorkItemSummary[] = []): Report {
  const previousIds = new Set(previous.map((item) => item.id));
  const newItems = current.filter((item) => !previousIds.has(item.id));
  const highPriorityNew = newItems.filter((item) => (item.priority || 99) <= 2);
  const findings = [
    ...newItems.slice(0, 10).map((item) =>
      findingForItem(item, highPriorityNew.includes(item) ? 80 : 45, ["new since comparison snapshot"], "Confirm whether this is approved scope or backlog noise.")
    )
  ];
  return report("Scope Creep Detector", findings, {
    summary: `${newItems.length} new Work Items detected compared with the supplied baseline.`,
    metrics: { currentItems: current.length, previousItems: previous.length, newItems: newItems.length, highPriorityNewItems: highPriorityNew.length }
  });
}

export function statusBrief(items: WorkItemSummary[]): Report {
  const open = items.filter((item) => !isClosed(item));
  const risks = deliveryRiskRadar(items).findings.slice(0, 5);
  return report("Executive Status Brief", risks, {
    summary: `Portfolio contains ${items.length} items: ${open.length} open and ${items.length - open.length} closed/resolved. Top risks are based on stale, blocked, unassigned, and high-priority signals.`,
    metrics: { total: items.length, open: open.length, closed: items.length - open.length },
    nextActions: risks.map((risk) => `Review ${risk.id ? `#${risk.id}` : risk.title}: ${risk.recommendation}`)
  });
}

export function decisionDebt(items: WorkItemSummary[]): Report {
  const findings = items
    .filter((item) => !isClosed(item) && hasAny(item, DECISION_WORDS))
    .map((item) => findingForItem(item, 70, ["decision/approval language detected"], "Assign a named decision owner and due date."))
    .slice(0, 20);
  return report("Decision Debt Tracker", findings, { summary: `${findings.length} open items appear to need decisions or approvals.` });
}

export function bottleneckMining(items: WorkItemSummary[]): Report {
  const byState = group(items.filter((item) => !isClosed(item)), (item) => item.state || "Unknown");
  const findings = Object.entries(byState)
    .map(([state, stateItems]) => {
      const avgAge = average(stateItems.map((item) => daysSince(item.changedDate)));
      return {
        title: `${state}: ${stateItems.length} open items`,
        score: Math.min(100, Math.round(avgAge * 4 + stateItems.length * 3)),
        severity: avgAge > 14 || stateItems.length > 10 ? "high" : "medium",
        signals: [`average state age ${Math.round(avgAge)} days`, `${stateItems.length} items in state`],
        recommendation: "Inspect queue policy, WIP limit, ownership, and review handoff for this state."
      } satisfies Finding;
    })
    .sort(byScoreDesc);
  return report("Process Bottleneck Mining", findings, { summary: "Potential bottlenecks are ranked by queue size and stale time in current state." });
}

export function workflowConformance(items: WorkItemSummary[], policy: Record<string, unknown> = {}): Report {
  const requiredTags = arrayPolicy(policy.requiredTags);
  const requiredTypes = arrayPolicy(policy.allowedTypes);
  const findings: Finding[] = [];
  for (const item of items) {
    const signals: string[] = [];
    if (!item.title || item.title.length < 8) signals.push("title is missing or too short");
    if (!item.assignedTo && !isClosed(item)) signals.push("open item has no assignee");
    for (const tag of requiredTags) {
      if (!item.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())) signals.push(`missing required tag ${tag}`);
    }
    if (requiredTypes.length && !requiredTypes.includes(item.type)) signals.push(`type ${item.type} is outside allowed policy`);
    if (signals.length) {
      findings.push(findingForItem(item, Math.min(100, signals.length * 25), signals, "Bring the Work Item back into the agreed workflow policy."));
    }
  }
  return report("Workflow Conformance Checker", findings.sort(byScoreDesc), {
    summary: `${findings.length} Work Items violate at least one configured or default process rule.`
  });
}

export function slaAgingMonitor(items: WorkItemSummary[], slaDays = 14): Report {
  const findings = items
    .filter((item) => !isClosed(item))
    .map((item) => {
      const age = daysSince(item.createdDate);
      const stale = daysSince(item.changedDate);
      const signals: string[] = [];
      if (age > slaDays) signals.push(`age ${age} days exceeds SLA ${slaDays}`);
      if (stale > Math.ceil(slaDays / 2)) signals.push(`no update for ${stale} days`);
      return signals.length ? findingForItem(item, Math.min(100, age * 2 + stale * 2), signals, "Escalate, update, or explicitly exempt this item.") : null;
    })
    .filter((finding): finding is Finding => Boolean(finding))
    .sort(byScoreDesc);
  return report("SLA & Aging Monitor", findings, { summary: `${findings.length} open Work Items breach the configured SLA/aging thresholds.` });
}

export function rootCausePatterns(items: WorkItemSummary[]): Report {
  const patterns = [
    { title: "Requirements quality", words: ["unclear", "clarify", "requirement", "acceptance"] },
    { title: "Dependencies", words: ["dependency", "blocked", "waiting", "external"] },
    { title: "Defect recurrence", words: ["regression", "again", "reopen", "flaky"] },
    { title: "Priority churn", words: ["urgent", "priority", "escalate", "hotfix"] }
  ];
  const findings = patterns
    .map((pattern) => {
      const matches = items.filter((item) => hasAny(item, pattern.words));
      return {
        title: pattern.title,
        score: Math.min(100, matches.length * 12),
        severity: matches.length > 5 ? "high" : matches.length > 2 ? "medium" : "low",
        signals: [`${matches.length} matching Work Items`, `keywords: ${pattern.words.join(", ")}`],
        recommendation: "Review sample tickets and add a process improvement action if the pattern is confirmed."
      } satisfies Finding;
    })
    .filter((finding) => (finding.score || 0) > 0)
    .sort(byScoreDesc);
  return report("Root Cause Pattern Finder", findings, { summary: "Patterns are heuristic clusters from Work Item text, tags, and state metadata." });
}

export function processRecommendations(items: WorkItemSummary[]): Report {
  const conformance = workflowConformance(items).findings.length;
  const aging = slaAgingMonitor(items).findings.length;
  const bottlenecks = bottleneckMining(items).findings.slice(0, 2);
  const findings: Finding[] = [
    {
      title: "Introduce explicit stale-item review",
      score: Math.min(100, aging * 10),
      severity: aging > 5 ? "high" as const : "medium" as const,
      signals: [`${aging} SLA/aging findings`],
      recommendation: "Add a weekly review routine for items stale beyond half the SLA."
    },
    {
      title: "Harden Definition of Ready / Done",
      score: Math.min(100, conformance * 8),
      severity: conformance > 8 ? "high" as const : "medium" as const,
      signals: [`${conformance} workflow conformance findings`],
      recommendation: "Require owner, acceptance criteria, and classification tags before active work starts."
    },
    ...bottlenecks.map((b) => ({ ...b, title: `Tune WIP for ${b.title}` }))
  ].sort(byScoreDesc);
  return report("Process Improvement Recommendations", findings.slice(0, 5), { summary: "Top process improvements based on current board data." });
}

export function governanceScore(items: WorkItemSummary[], policy: Record<string, unknown> = {}): Report {
  const violations = workflowConformance(items, policy).findings;
  const score = Math.max(0, 100 - Math.round((violations.length / Math.max(items.length, 1)) * 100));
  return report(
    "Process Governance Copilot",
    [
      {
        title: `Governance score ${score}/100`,
        score,
        severity: score < 60 ? "high" : score < 80 ? "medium" : "low",
        signals: [`${violations.length} policy findings`, `${items.length} assessed Work Items`],
        recommendation: score < 80 ? "Review policy gaps and enforce required fields/tags at workflow entry." : "Maintain current governance controls."
      }
    ],
    { metrics: { governanceScore: score, violations: violations.length, assessedItems: items.length } }
  );
}

export function policyGapDetector(items: WorkItemSummary[], policy: Record<string, unknown> = {}): Report {
  return {
    ...workflowConformance(items, policy),
    title: "Policy Gap Detector",
    summary: `${workflowConformance(items, policy).findings.length} policy gaps found for Process Owner review.`
  };
}

export function changeImpact(items: WorkItemSummary[], proposedRule: string): Report {
  const rule = proposedRule.toLowerCase();
  const impacted = items.filter((item) => {
    if (rule.includes("assignee")) return !item.assignedTo;
    if (rule.includes("tag")) return item.tags.length === 0;
    if (rule.includes("priority")) return item.priority === undefined;
    if (rule.includes("closed")) return isClosed(item);
    return !isClosed(item);
  });
  return report(
    "Change Impact Analyzer",
    impacted.slice(0, 25).map((item) => findingForItem(item, 60, [`would be affected by rule: ${proposedRule}`], "Review before enforcing the proposed process change.")),
    { summary: `${impacted.length} Work Items would likely be affected by the proposed rule.` }
  );
}

export function crossTeamBenchmark(items: WorkItemSummary[]): Report {
  const byArea = group(items, (item) => item.areaPath || "Unknown");
  const findings = Object.entries(byArea)
    .map(([area, areaItems]) => {
      const open = areaItems.filter((item) => !isClosed(item));
      const avgAge = average(open.map((item) => daysSince(item.createdDate)));
      return {
        title: area,
        score: Math.min(100, Math.round(avgAge * 2 + open.length)),
        severity: avgAge > 30 ? "high" : avgAge > 14 ? "medium" : "low",
        signals: [`${open.length} open items`, `average open age ${Math.round(avgAge)} days`, `${areaItems.length} total items`],
        recommendation: "Compare aging, risk, and conformance with peer areas before changing team policy."
      } satisfies Finding;
    })
    .sort(byScoreDesc);
  return report("Cross-Team Benchmarking", findings, { summary: "Area Paths are benchmarked by open volume and aging." });
}

export function auditEvidencePack(items: WorkItemSummary[], policy: Record<string, unknown> = {}): Report {
  const gaps = workflowConformance(items, policy).findings;
  const aging = slaAgingMonitor(items).findings;
  return report("Audit Evidence Pack", [...gaps, ...aging].slice(0, 50), {
    summary: `Evidence pack contains ${gaps.length} policy gaps and ${aging.length} SLA/aging findings.`,
    metrics: { assessedItems: items.length, policyGaps: gaps.length, slaFindings: aging.length }
  });
}

export function improveWorkItem(input: Record<string, unknown>): Record<string, unknown> {
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const acceptanceCriteria = String(input.acceptanceCriteria || "").trim();
  const type = String(input.type || "Work Item");
  const suggestions: Record<string, string> = {};
  if (!title || title.length < 12) suggestions.title = `${type}: clarify user, outcome, and constraint`;
  if (!description || description.length < 40) suggestions.description = "Problem:\n\nUser impact:\n\nCurrent behavior:\n\nExpected behavior:\n\nNotes:";
  if (!acceptanceCriteria || acceptanceCriteria.length < 20) {
    suggestions.acceptanceCriteria = "- Given relevant context, when the work is complete, then the expected user outcome is observable.\n- Error and edge cases are covered.\n- QA/review evidence is attached or linked.";
  }
  const patch = buildFieldPatch({
    title: suggestions.title,
    description: suggestions.description,
    acceptanceCriteria: suggestions.acceptanceCriteria
  });
  return {
    writePerformed: false,
    message: "Review this JSON Patch preview, then call azure_boards_update_work_item if you want to apply it.",
    checkedFields: QUALITY_FIELDS,
    suggestions,
    patchPreview: patch
  };
}

export function naturalLanguageToWiql(input: Record<string, unknown>): Record<string, unknown> {
  const text = String(input.query || input.request || "").toLowerCase();
  const project = String(input.project || "@project");
  const clauses = [`[System.TeamProject] = '${escapeWiql(project)}'`];
  if (text.includes("bug")) clauses.push("[System.WorkItemType] = 'Bug'");
  if (text.includes("task")) clauses.push("[System.WorkItemType] = 'Task'");
  if (text.includes("open") || text.includes("offen")) clauses.push("[System.State] <> 'Closed'");
  if (text.includes("unassigned") || text.includes("nicht zugewiesen")) clauses.push("[System.AssignedTo] = ''");
  if (text.includes("high") || text.includes("hoch")) clauses.push("[Microsoft.VSTS.Common.Priority] <= 2");
  if (text.includes("stale") || text.includes("alt")) clauses.push("[System.ChangedDate] < @Today - 7");
  return {
    wiql: `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo] FROM WorkItems WHERE ${clauses.join(" AND ")} ORDER BY [System.ChangedDate] DESC`,
    writePerformed: false,
    explanation: "Generated a conservative WIQL query from common delivery/process terms. Review before executing."
  };
}

export function findDuplicates(items: WorkItemSummary[]): Report {
  const findings: Finding[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const score = similarity(items[i].title, items[j].title);
      if (score > 0.55) {
        findings.push({
          title: `Possible duplicate: #${items[i].id} and #${items[j].id}`,
          score: Math.round(score * 100),
          severity: score > 0.75 ? "high" : "medium",
          signals: [`similar titles`, `${items[i].type}/${items[j].type}`, `${items[i].state}/${items[j].state}`],
          recommendation: "Compare descriptions and relations, then close/link duplicates if confirmed."
        });
      }
    }
  }
  return report("Duplicate & Similar Work Detector", findings.sort(byScoreDesc).slice(0, 20), {
    summary: `${findings.length} possible duplicate pairs found.`
  });
}

export function watchlistReport(items: WorkItemSummary[], optionsOrPolicy: Record<string, unknown> = {}): Report & { writePerformed: false } {
  const source = baseWatchlistReport(items, optionsOrPolicy);
  return {
    title: source.title,
    generatedAt: source.generatedAt,
    summary: source.summary,
    writePerformed: false,
    metrics: source.metrics,
    findings: source.watchlist.map((entry) => ({
      id: entry.id,
      title: `#${entry.id} ${entry.title}`,
      score: entry.score,
      severity: entry.severity,
      signals: entry.evidenceSignals,
      recommendation: entry.recommendedAction
    })),
    nextActions: source.watchlist.slice(0, 5).map((entry) => entry.recommendedAction)
  };
}

export function actionPlan(
  items: WorkItemSummary[],
  policy: Record<string, unknown> = {},
  options: Record<string, unknown> = {}
): Report & { writePerformed: false; actions: unknown[] } {
  const source = baseActionPlan(items, policy, options);
  return {
    title: source.title,
    generatedAt: source.generatedAt,
    summary: source.summary,
    writePerformed: false,
    metrics: source.metrics,
    actions: source.actions,
    findings: source.actions.map((action) => ({
      id: action.id,
      title: `#${action.id} ${action.action}`,
      score: action.score,
      severity: action.severity,
      signals: action.evidenceSignals,
      recommendation: action.rationale
    })),
    nextActions: source.actions.map((action) => action.action)
  };
}

export function createProcessBaseline(
  items: WorkItemSummary[],
  updatesOrPolicy: Record<string, unknown>[] | Record<string, unknown> = {},
  policy: Record<string, unknown> = {}
): ProcessBaseline & { title: string; summary: string; writePerformed: false; updateEvidenceCount: number } {
  const updates = Array.isArray(updatesOrPolicy) ? updatesOrPolicy : [];
  const effectivePolicy = Array.isArray(updatesOrPolicy) ? policy : updatesOrPolicy;
  const baseline = baseCreateProcessBaseline(items, effectivePolicy);
  return {
    ...baseline,
    title: "Process Baseline",
    summary: `Process baseline captured ${items.length} items and ${updates.length} update events for flow, throughput, WIP, and governance comparison.`,
    writePerformed: false,
    updateEvidenceCount: updates.length
  };
}

export function processDriftDetection(
  items: WorkItemSummary[],
  baseline: ProcessBaseline,
  policy: Record<string, unknown> = {}
): Report & { writePerformed: false; drifted: boolean } {
  const source = baseProcessDriftDetection(items, baseline, policy);
  return {
    title: "Process Drift Detection",
    generatedAt: source.referenceDate,
    summary: source.summary,
    writePerformed: false,
    drifted: source.drifted,
    metrics: Object.fromEntries(source.metrics.map((metric) => [metric.metric, metric.delta])),
    findings: source.metrics
      .filter((metric) => metric.drifted)
      .map((metric) => ({
        title: `${metric.metric} drift ${metric.direction}`,
        score: Math.min(100, Math.round(Math.abs(metric.relativeDelta) * 100)),
        severity: Math.abs(metric.delta) > metric.threshold * 2 ? "high" : "medium",
        signals: [
          `baseline ${metric.baseline}`,
          `current ${metric.current}`,
          `delta ${metric.delta}`,
          `threshold ${metric.threshold}`
        ],
        recommendation: "Review process drift with the Process Owner and decide whether to correct the work items or update the baseline."
      })),
    nextActions: ["Review drifted metrics.", "Decide whether the baseline or the current process needs correction."]
  };
}

export function costOfDelayRadar(items: WorkItemSummary[], options: Record<string, unknown> = {}): Report & { writePerformed: false } {
  return { ...baseCostOfDelayRadar(items, options), writePerformed: false };
}

export function processSimulator(items: WorkItemSummary[], scenario: Record<string, unknown>): Report & { writePerformed: false } {
  return { ...baseProcessSimulator(items, scenario), writePerformed: false };
}

export function capacityForecast(items: WorkItemSummary[], options: Record<string, unknown> = {}): Report & { writePerformed: false } {
  return { ...baseCapacityForecast(items, options), writePerformed: false };
}

export function briefExport(reportOrReports: Report | Report[], options: Record<string, unknown> = {}): ReturnType<typeof baseBriefExport> & {
  summary: string;
  format: string;
} {
  const result = baseBriefExport(reportOrReports, options);
  return {
    ...result,
    summary: `Brief export prepared for ${result.audience}.`,
    format: result.html ? "html+markdown" : "markdown"
  };
}

export function projectCockpit(items: WorkItemSummary[], policy: Record<string, unknown> = {}): Report {
  const open = items.filter((item) => !isClosed(item));
  const closed = items.length - open.length;
  const stale = open.filter((item) => daysSince(item.changedDate) > 10);
  const unassigned = open.filter((item) => !item.assignedTo);
  const blocked = open.filter((item) => hasAny(item, BLOCKER_WORDS));
  const highPriority = open.filter((item) => (item.priority || 99) <= 2);
  const governanceFindings = workflowConformance(items, policy).findings.length;
  const flowEfficiency = Math.max(0, Math.round((closed / Math.max(items.length, 1)) * 100 - (stale.length / Math.max(open.length, 1)) * 20));
  const riskScore = Math.min(
    100,
    Math.round(
      (stale.length / Math.max(open.length, 1)) * 30 +
        (unassigned.length / Math.max(open.length, 1)) * 20 +
        blocked.length * 8 +
        highPriority.length * 4 +
        governanceFindings * 3
    )
  );
  const findings: Finding[] = [
    {
      title: `Portfolio health ${Math.max(0, 100 - riskScore)}/100`,
      score: Math.max(0, 100 - riskScore),
      severity: riskScore > 70 ? "high" : riskScore > 40 ? "medium" : "low",
      signals: [`${items.length} total items`, `${open.length} open`, `${closed} closed/resolved`, `${flowEfficiency}% flow efficiency indicator`],
      recommendation: riskScore > 40 ? "Focus the next review on stale, blocked, unassigned, and policy-violating work." : "Keep current delivery controls and monitor for aging drift."
    },
    {
      title: "Execution risk concentration",
      score: riskScore,
      severity: riskScore > 70 ? "critical" : riskScore > 40 ? "high" : "medium",
      signals: [`${stale.length} stale open items`, `${blocked.length} blocker signals`, `${unassigned.length} unassigned open items`, `${highPriority.length} high-priority open items`],
      recommendation: "Review the riskiest open items and assign dated next actions."
    },
    {
      title: "Governance readiness",
      score: Math.max(0, 100 - Math.round((governanceFindings / Math.max(items.length, 1)) * 100)),
      severity: governanceFindings > Math.max(5, items.length * 0.2) ? "high" : governanceFindings ? "medium" : "low",
      signals: [`${governanceFindings} conformance findings`, `${items.length} assessed items`],
      recommendation: governanceFindings ? "Close policy gaps before audit or release reporting." : "No configured policy gaps detected."
    }
  ];
  return report("Project Cockpit", findings, {
    summary: `Project cockpit: ${open.length} open, ${closed} closed/resolved, ${riskScore}/100 execution risk.`,
    metrics: {
      totalItems: items.length,
      openItems: open.length,
      closedItems: closed,
      staleOpenItems: stale.length,
      blockerSignals: blocked.length,
      unassignedOpenItems: unassigned.length,
      highPriorityOpenItems: highPriority.length,
      governanceFindings,
      flowEfficiency,
      executionRiskScore: riskScore
    },
    nextActions: ["Triage blocked and stale high-priority work.", "Assign owners to open unassigned items.", "Resolve policy gaps before external reporting."]
  });
}

export function flowMiningFromUpdates(items: WorkItemSummary[], updates: Record<string, unknown>[] = []): Report {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const transitions = updates.map(normalizeUpdate).filter((update) => update.workItemId && update.toState);
  const transitionCounts = group(transitions, (update) => `${update.fromState || "(new)"} -> ${update.toState}`);
  const itemTransitions = group(transitions, (update) => String(update.workItemId));
  const findings: Finding[] = Object.entries(transitionCounts)
    .map(([transition, matching]) => ({
      title: transition,
      score: Math.min(100, matching.length * 10),
      severity: matching.length > 10 ? "high" : matching.length > 4 ? "medium" : "low",
      signals: [`${matching.length} observed transitions`, `${uniqueCount(matching.map((update) => update.workItemId))} affected items`],
      recommendation: "Validate whether this transition volume matches the intended workflow path."
    }) satisfies Finding)
    .sort(byScoreDesc);

  for (const [id, matching] of Object.entries(itemTransitions)) {
    const item = itemById.get(Number(id));
    const stateChanges = matching.length;
    const reopenCount = matching.filter((update) => isClosedState(update.fromState) && update.toState && !isClosedState(update.toState)).length;
    const churnScore = Math.min(100, stateChanges * 12 + reopenCount * 25);
    if (churnScore >= 40) {
      findings.push({
        id: Number(id),
        title: item ? `#${item.id} ${item.title || "(untitled)"}` : `Work Item #${id}`,
        score: churnScore,
        severity: churnScore > 80 ? "critical" : churnScore > 60 ? "high" : "medium",
        signals: [`${stateChanges} state transitions`, `${reopenCount} reopen transitions`],
        recommendation: "Inspect handoffs, acceptance quality, and reopen root causes for this item."
      });
    }
  }

  if (!transitions.length) {
    findings.push(...bottleneckMining(items).findings.slice(0, 5).map((finding) => ({ ...finding, title: `Current-state fallback: ${finding.title}` })));
  }

  return report("Flow Mining From Updates", findings.sort(byScoreDesc).slice(0, 30), {
    summary: transitions.length
      ? `Mined ${transitions.length} state transitions from supplied updates.`
      : "No state transitions were supplied; fallback findings use current Work Item state and aging.",
    metrics: {
      suppliedUpdates: updates.length,
      minedTransitions: transitions.length,
      distinctTransitionPaths: Object.keys(transitionCounts).length,
      churnItems: Object.values(itemTransitions).filter((matching) => matching.length >= 4).length
    }
  });
}

export function commentIntelligence(items: WorkItemSummary[], comments: Record<string, unknown>[] = []): Report {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const enriched = comments.map(normalizeComment).filter((comment) => comment.text.length);
  const categories = [
    { title: "Blockers and dependencies", words: BLOCKER_WORDS, recommendation: "Escalate blockers with owner, dependency, and target unblock date." },
    { title: "Decision and approval debt", words: DECISION_WORDS, recommendation: "Assign a decision owner and record the decision in the Work Item." },
    { title: "Delivery risk language", words: RISK_WORDS, recommendation: "Review whether risk is reflected in priority, state, and milestone forecast." },
    { title: "Customer or production impact", words: CUSTOMER_WORDS, recommendation: "Confirm customer impact, severity, and communication owner." }
  ];
  const findings: Finding[] = [];

  for (const category of categories) {
    const matches = enriched.filter((comment) => includesAny(comment.text, category.words));
    if (matches.length) {
      findings.push({
        title: category.title,
        score: Math.min(100, matches.length * 15),
        severity: matches.length > 8 ? "high" : matches.length > 3 ? "medium" : "low",
        signals: [`${matches.length} matching comments`, `${uniqueCount(matches.map((comment) => comment.workItemId || 0).filter(Boolean))} affected Work Items`, `keywords: ${category.words.join(", ")}`],
        recommendation: category.recommendation
      });
    }
  }

  const byItem = group(enriched.filter((comment) => Boolean(comment.workItemId)), (comment) => String(comment.workItemId));
  for (const [id, itemComments] of Object.entries(byItem)) {
    const signals: string[] = [];
    const combined = itemComments.map((comment) => comment.text).join(" ");
    if (includesAny(combined, BLOCKER_WORDS)) signals.push("blocker/dependency discussion");
    if (includesAny(combined, DECISION_WORDS)) signals.push("decision/approval discussion");
    if (includesAny(combined, RISK_WORDS)) signals.push("risk/escalation discussion");
    if (includesAny(combined, CUSTOMER_WORDS)) signals.push("customer/production impact discussion");
    if (signals.length >= 2) {
      const item = itemById.get(Number(id));
      findings.push({
        id: Number(id),
        title: item ? `#${item.id} ${item.title || "(untitled)"}` : `Work Item #${id}`,
        score: Math.min(100, signals.length * 25 + itemComments.length * 3),
        severity: signals.length > 2 ? "high" : "medium",
        signals: [...signals, `${itemComments.length} supplied comments`],
        recommendation: "Summarize the thread into explicit next action, owner, and due date."
      });
    }
  }

  return report("Comment Intelligence", findings.sort(byScoreDesc).slice(0, 30), {
    summary: `Analyzed ${enriched.length} supplied comments for blockers, decision debt, delivery risk, and customer impact.`,
    metrics: { suppliedComments: comments.length, analyzedComments: enriched.length, commentFindings: findings.length }
  });
}

export function roleBasedReport(items: WorkItemSummary[], roleOrOptions: string | Record<string, unknown> = "executive", policy: Record<string, unknown> = {}): Report {
  const role = typeof roleOrOptions === "string" ? roleOrOptions.toLowerCase() : String(roleOrOptions.role || "executive").toLowerCase();
  const effectivePolicy = typeof roleOrOptions === "string" ? policy : (roleOrOptions.policy && typeof roleOrOptions.policy === "object" ? roleOrOptions.policy as Record<string, unknown> : policy);
  const source =
    role.includes("exec") || role.includes("leadership")
      ? projectCockpit(items, effectivePolicy)
      : role.includes("qa") || role.includes("quality") || role.includes("test")
        ? auditEvidencePack(items, effectivePolicy)
        : role.includes("product") || role.includes("po")
          ? scopeCreepDetector(items)
          : role.includes("scrum") || role.includes("delivery")
            ? milestoneForecast(items)
            : deliveryRiskRadar(items);
  const findings = source.findings.slice(0, 8).map((finding) => ({
    ...finding,
    recommendation: roleRecommendation(role, finding.recommendation)
  }));
  return report("Role-Based Report", findings, {
    summary: `Prepared ${role} view from ${source.title}: ${source.summary}`,
    metrics: { assessedItems: items.length, sourceFindings: source.findings.length, returnedFindings: findings.length, role },
    nextActions: roleNextActions(role)
  });
}

export function policyPackSummary(items: WorkItemSummary[], policyPack: Record<string, unknown> = {}): Report {
  const policies = extractPolicies(policyPack);
  const findings: Finding[] = [];
  for (const policy of policies) {
    const conformance = workflowConformance(items, policy.rules);
    const slaDays = numericPolicy(policy.rules.slaDays);
    const sla = slaDays ? slaAgingMonitor(items, slaDays) : undefined;
    const issueCount = conformance.findings.length + (sla?.findings.length || 0);
    const score = Math.max(0, 100 - Math.round((issueCount / Math.max(items.length, 1)) * 100));
    findings.push({
      title: policy.name,
      score,
      severity: score < 60 ? "high" : score < 80 ? "medium" : "low",
      signals: [
        `${conformance.findings.length} workflow findings`,
        `${sla?.findings.length || 0} SLA findings`,
        `${arrayPolicy(policy.rules.requiredTags).length} required tags`,
        `${arrayPolicy(policy.rules.allowedTypes).length} allowed types`
      ],
      recommendation: score < 80 ? "Review failed controls and decide whether to fix Work Items or adjust the policy." : "Policy pack controls are currently passing at portfolio level."
    });
  }
  const averageScore = Math.round(average(findings.map((finding) => finding.score || 0)));
  return report("Policy Pack Summary", findings.sort(byScoreDesc), {
    summary: `Evaluated ${policies.length} supplied policies with average score ${averageScore}/100.`,
    metrics: { assessedItems: items.length, policies: policies.length, averagePolicyScore: averageScore }
  });
}

function report(title: string, findings: Finding[], options: Partial<Report> = {}): Report {
  return {
    title,
    generatedAt: new Date().toISOString(),
    summary: options.summary || `${findings.length} findings generated.`,
    findings,
    metrics: options.metrics,
    nextActions: options.nextActions
  };
}

function findingForItem(item: WorkItemSummary, score: number, signals: string[], recommendation: string): Finding {
  return {
    id: item.id,
    title: `#${item.id} ${item.title || "(untitled)"}`,
    score,
    severity: score > 80 ? "critical" : score > 60 ? "high" : score > 30 ? "medium" : "low",
    signals,
    recommendation
  };
}

function isClosed(item: WorkItemSummary): boolean {
  return CLOSED_STATES.has((item.state || "").toLowerCase());
}

function daysSince(value?: string): number {
  if (!value) return 0;
  const ms = Date.now() - new Date(value).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

function hasAny(item: WorkItemSummary, words: string[]): boolean {
  const haystack = `${item.title} ${item.tags.join(" ")} ${item.type} ${item.state}`.toLowerCase();
  return words.some((word) => haystack.includes(word));
}

function byScoreDesc(a: Finding, b: Finding): number {
  return (b.score || 0) - (a.score || 0);
}

function group<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const groupKey = key(item);
    acc[groupKey] ||= [];
    acc[groupKey].push(item);
    return acc;
  }, {});
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function arrayPolicy(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numericPolicy(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function escapeWiql(value: string): string {
  return value.replace(/'/g, "''");
}

function similarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection++;
  }
  return intersection / union.size;
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9äöüß]+/i)
      .filter((token) => token.length > 2)
  );
}

interface NormalizedUpdate {
  workItemId?: number;
  fromState?: string;
  toState?: string;
}

interface NormalizedComment {
  workItemId?: number;
  text: string;
}

interface NamedPolicy {
  name: string;
  rules: Record<string, unknown>;
}

function normalizeUpdate(update: Record<string, unknown>): NormalizedUpdate {
  const fields = update.fields && typeof update.fields === "object" ? update.fields as Record<string, unknown> : {};
  const stateField = fields["System.State"] && typeof fields["System.State"] === "object" ? fields["System.State"] as Record<string, unknown> : {};
  const workItem = update.workItem && typeof update.workItem === "object" ? update.workItem as Record<string, unknown> : {};
  return {
    workItemId: numberFrom(update.workItemId) || numberFrom(update.id) || numberFrom(workItem.id),
    fromState: stringFrom(update.fromState) || stringFrom(update.oldState) || stringFrom(stateField.oldValue),
    toState: stringFrom(update.toState) || stringFrom(update.newState) || stringFrom(update.state) || stringFrom(stateField.newValue)
  };
}

function normalizeComment(comment: Record<string, unknown>): NormalizedComment {
  const nested = comment.comment && typeof comment.comment === "object" ? comment.comment as Record<string, unknown> : {};
  const workItem = comment.workItem && typeof comment.workItem === "object" ? comment.workItem as Record<string, unknown> : {};
  return {
    workItemId: numberFrom(comment.workItemId) || numberFrom(comment.id) || numberFrom(workItem.id),
    text: stringFrom(comment.text) || stringFrom(comment.comment) || stringFrom(comment.content) || stringFrom(nested.text)
  };
}

function extractPolicies(policyPack: Record<string, unknown>): NamedPolicy[] {
  const rawPolicies = policyPack.policies;
  if (Array.isArray(rawPolicies)) {
    return rawPolicies
      .filter((policy): policy is Record<string, unknown> => policy !== null && typeof policy === "object" && !Array.isArray(policy))
      .map((policy, index) => ({
        name: stringFrom(policy.name) || stringFrom(policy.title) || `Policy ${index + 1}`,
        rules: policy.rules && typeof policy.rules === "object" && !Array.isArray(policy.rules) ? policy.rules as Record<string, unknown> : policy
      }));
  }
  if (rawPolicies && typeof rawPolicies === "object") {
    return Object.entries(rawPolicies as Record<string, unknown>)
      .filter((entry): entry is [string, Record<string, unknown>] => entry[1] !== null && typeof entry[1] === "object" && !Array.isArray(entry[1]))
      .map(([name, rules]) => ({ name, rules }));
  }
  return [{ name: stringFrom(policyPack.name) || "Default Policy", rules: policyPack }];
}

function roleRecommendation(role: string, recommendation: string): string {
  if (role.includes("exec") || role.includes("leadership")) return `Decide ownership, escalation, or scope tradeoff. ${recommendation}`;
  if (role.includes("qa") || role.includes("quality") || role.includes("test")) return `Convert this into verifiable evidence or a quality gate. ${recommendation}`;
  if (role.includes("product") || role.includes("po")) return `Clarify priority, customer value, and scope decision. ${recommendation}`;
  if (role.includes("scrum") || role.includes("delivery")) return `Turn this into a dated delivery impediment action. ${recommendation}`;
  return recommendation;
}

function roleNextActions(role: string): string[] {
  if (role.includes("exec") || role.includes("leadership")) return ["Resolve top ownership/escalation decisions.", "Confirm milestone confidence and scope tradeoffs."];
  if (role.includes("qa") || role.includes("quality") || role.includes("test")) return ["Attach missing evidence for policy and SLA findings.", "Prioritize defects or reopened items with repeated risk signals."];
  if (role.includes("product") || role.includes("po")) return ["Approve or reject new scope.", "Clarify acceptance criteria for high-risk items."];
  if (role.includes("scrum") || role.includes("delivery")) return ["Unblock stale work.", "Update owners and next actions before the next standup."];
  return ["Review the top findings.", "Assign an owner and next action to each high-severity item."];
}

function includesAny(value: string, words: string[]): boolean {
  const haystack = value.toLowerCase();
  return words.some((word) => haystack.includes(word));
}

function uniqueCount(values: Array<number | undefined>): number {
  return new Set(values.filter((value): value is number => typeof value === "number")).size;
}

function isClosedState(value?: string): boolean {
  return CLOSED_STATES.has((value || "").toLowerCase());
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
