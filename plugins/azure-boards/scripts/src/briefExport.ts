import type { Finding, Report } from "./types.js";

export type BriefExportType = "weekly-steering" | "daily-risk" | "audit-update";

export interface BriefExportOptions {
  type?: BriefExportType | "weeklySteering" | "dailyRisk" | "auditUpdate" | "weekly" | "daily" | "audit";
  audience?: string;
  title?: string;
  includeHtml?: boolean;
}

export interface BriefExportResult {
  markdown: string;
  html?: string;
  audience: string;
  title: string;
  generatedAt: string;
  writePerformed: false;
}

interface BriefProfile {
  type: BriefExportType;
  title: string;
  audience: string;
  focus: string;
  maxFindings: number;
}

const PROFILES: Record<BriefExportType, BriefProfile> = {
  "weekly-steering": {
    type: "weekly-steering",
    title: "Weekly Steering Brief",
    audience: "Executive steering group",
    focus: "Portfolio health, decisions, escalations, and next steering actions.",
    maxFindings: 8
  },
  "daily-risk": {
    type: "daily-risk",
    title: "Daily Risk Brief",
    audience: "Delivery leads and risk owners",
    focus: "Immediate delivery risks, blockers, stale work, and ownership gaps.",
    maxFindings: 6
  },
  "audit-update": {
    type: "audit-update",
    title: "Audit Update Brief",
    audience: "Process owners, audit stakeholders, and governance reviewers",
    focus: "Policy evidence, SLA exposure, governance gaps, and remediation status.",
    maxFindings: 10
  }
};

export function briefExport(reportOrReports: Report | Report[], options: BriefExportOptions = {}): BriefExportResult {
  const reports = normalizeReports(reportOrReports);
  const profile = { ...PROFILES[normalizeType(options.type, reports)] };
  const title = clean(options.title) || profile.title;
  const audience = clean(options.audience) || profile.audience;
  const generatedAt = new Date().toISOString();
  const findings = selectFindings(reports, profile);
  const markdown = renderMarkdown({ reports, findings, profile, title, audience, generatedAt });
  const result: BriefExportResult = {
    markdown,
    audience,
    title,
    generatedAt,
    writePerformed: false
  };
  if (options.includeHtml) {
    result.html = renderHtml(markdown);
  }
  return result;
}

function normalizeReports(reportOrReports: Report | Report[]): Report[] {
  const reports = Array.isArray(reportOrReports) ? reportOrReports : [reportOrReports];
  if (!reports.length) {
    throw new Error("briefExport requires at least one report.");
  }
  return reports.map((report, index) => {
    if (!report || typeof report !== "object") {
      throw new Error(`report[${index}] must be an object.`);
    }
    return {
      title: clean(report.title) || `Report ${index + 1}`,
      generatedAt: clean(report.generatedAt) || "",
      summary: clean(report.summary) || "No summary supplied.",
      findings: Array.isArray(report.findings) ? report.findings : [],
      metrics: report.metrics,
      nextActions: Array.isArray(report.nextActions) ? report.nextActions.filter((action): action is string => typeof action === "string") : undefined
    };
  });
}

function normalizeType(type: BriefExportOptions["type"], reports: Report[]): BriefExportType {
  const value = clean(type).toLowerCase().replace(/[_\s]+/g, "-");
  if (value === "weekly" || value === "weeklysteering" || value === "weekly-steering") return "weekly-steering";
  if (value === "daily" || value === "dailyrisk" || value === "daily-risk") return "daily-risk";
  if (value === "audit" || value === "auditupdate" || value === "audit-update") return "audit-update";

  const titles = reports.map((report) => report.title.toLowerCase()).join(" ");
  if (titles.includes("audit") || titles.includes("governance") || titles.includes("policy")) return "audit-update";
  if (titles.includes("risk") || titles.includes("sla") || titles.includes("aging")) return "daily-risk";
  return "weekly-steering";
}

function selectFindings(reports: Report[], profile: BriefProfile): Finding[] {
  return reports
    .flatMap((report) => report.findings)
    .filter((finding) => finding && typeof finding === "object")
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (b.score || 0) - (a.score || 0))
    .slice(0, profile.maxFindings);
}

function renderMarkdown(input: {
  reports: Report[];
  findings: Finding[];
  profile: BriefProfile;
  title: string;
  audience: string;
  generatedAt: string;
}): string {
  const lines: string[] = [
    `# ${input.title}`,
    "",
    `Audience: ${input.audience}`,
    `Generated: ${input.generatedAt}`,
    `Brief type: ${input.profile.type}`,
    "",
    `## Executive Focus`,
    input.profile.focus,
    "",
    "## Source Summary"
  ];

  for (const report of input.reports) {
    lines.push(`- ${report.title}: ${report.summary}`);
  }

  lines.push("", "## Key Signals");
  if (input.findings.length) {
    for (const finding of input.findings) {
      lines.push(`- ${formatFindingLead(finding)}`);
      for (const signal of finding.signals || []) {
        lines.push(`  - Signal: ${signal}`);
      }
      lines.push(`  - Recommendation: ${finding.recommendation || "Review and assign a clear owner."}`);
    }
  } else {
    lines.push("- No ranked findings were supplied.");
  }

  const metrics = mergeMetrics(input.reports);
  if (Object.keys(metrics).length) {
    lines.push("", "## Metrics");
    for (const [key, value] of Object.entries(metrics)) {
      lines.push(`- ${key}: ${String(value)}`);
    }
  }

  const nextActions = input.reports.flatMap((report) => report.nextActions || []).slice(0, 8);
  lines.push("", "## Recommended Next Actions");
  if (nextActions.length) {
    for (const action of nextActions) {
      lines.push(`- ${action}`);
    }
  } else {
    lines.push(...defaultActions(input.profile));
  }

  lines.push("", "_Export preview only. No Azure Boards write was performed._");
  return lines.join("\n");
}

function formatFindingLead(finding: Finding): string {
  const id = typeof finding.id === "number" ? `#${finding.id} ` : "";
  const severity = finding.severity ? ` (${finding.severity})` : "";
  const score = typeof finding.score === "number" ? `, score ${finding.score}` : "";
  return `${id}${finding.title}${severity}${score}`;
}

function mergeMetrics(reports: Report[]): Record<string, string | number> {
  const merged: Record<string, string | number> = {};
  for (const report of reports) {
    for (const [key, value] of Object.entries(report.metrics || {})) {
      merged[`${report.title}.${key}`] = value;
    }
  }
  return merged;
}

function defaultActions(profile: BriefProfile): string[] {
  if (profile.type === "daily-risk") {
    return ["- Assign an owner and dated next action for each high-risk item.", "- Escalate blockers that cannot be resolved today."];
  }
  if (profile.type === "audit-update") {
    return ["- Confirm evidence ownership for every open policy or SLA finding.", "- Record remediation status before the next governance review."];
  }
  return ["- Decide ownership for the top escalations.", "- Confirm scope, milestone confidence, and tradeoffs for the next steering cycle."];
}

function renderHtml(markdown: string): string {
  const body = markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("- ")) return `<li>${escapeHtml(line.slice(2))}</li>`;
      if (line.startsWith("  - ")) return `<li class="nested">${escapeHtml(line.slice(4))}</li>`;
      if (!line.trim()) return "";
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("\n");
  return `<!doctype html>\n<html><head><meta charset="utf-8"><title>Executive Brief</title></head><body>\n${body}\n</body></html>`;
}

function severityRank(severity: Finding["severity"]): number {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
