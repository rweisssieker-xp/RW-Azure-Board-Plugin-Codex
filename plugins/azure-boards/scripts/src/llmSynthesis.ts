import type { Finding, Report } from "./types.js";

export interface LlmSynthesisOptions {
  audience?: string;
  focus?: string;
  maxFindings?: number;
  maxOutputTokens?: number;
  model?: string;
}

export interface LlmSynthesisResult {
  summary: string;
  provider: "fallback" | "openai";
  model?: string;
  usedFallback: boolean;
  fallbackReason?: string;
}

const DEFAULT_MODEL = "gpt-4.1-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const SECRET_KEY_PATTERN = /(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|secret|pat)/i;

export async function synthesizeReport(
  reportOrReports: Report | Report[],
  options: LlmSynthesisOptions = {}
): Promise<LlmSynthesisResult> {
  const reports = normalizeReports(reportOrReports);
  const fallbackSummary = buildFallbackSummary(reports, options);
  const apiKey = process.env.OPENAI_API_KEY;
  const mode = (process.env.AZURE_BOARDS_LLM_MODE || "").trim().toLowerCase();

  if (!apiKey || mode !== "openai") {
    return {
      summary: fallbackSummary,
      provider: "fallback",
      usedFallback: true,
      fallbackReason: !apiKey ? "OPENAI_API_KEY is not configured." : "AZURE_BOARDS_LLM_MODE is not set to openai."
    };
  }

  const model = clean(options.model) || clean(process.env.AZURE_BOARDS_LLM_MODEL) || DEFAULT_MODEL;

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: buildPrompt(reports, options),
        max_output_tokens: clampInteger(options.maxOutputTokens, 128, 2000, 700),
        temperature: 0
      })
    });

    const body = await readResponseBody(response);
    if (!response.ok) {
      return {
        summary: fallbackSummary,
        provider: "fallback",
        model,
        usedFallback: true,
        fallbackReason: `OpenAI request failed with HTTP ${response.status}: ${redactSecrets(body)}`
      };
    }

    const summary = extractResponseText(body);
    if (!summary) {
      return {
        summary: fallbackSummary,
        provider: "fallback",
        model,
        usedFallback: true,
        fallbackReason: "OpenAI response did not include synthesis text."
      };
    }

    return {
      summary: redactSecrets(summary),
      provider: "openai",
      model,
      usedFallback: false
    };
  } catch (error) {
    return {
      summary: fallbackSummary,
      provider: "fallback",
      model,
      usedFallback: true,
      fallbackReason: `OpenAI synthesis error: ${redactSecrets(errorMessage(error))}`
    };
  }
}

function normalizeReports(reportOrReports: Report | Report[]): Report[] {
  const reports = Array.isArray(reportOrReports) ? reportOrReports : [reportOrReports];
  if (!reports.length) {
    throw new Error("synthesizeReport requires at least one report.");
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

function buildFallbackSummary(reports: Report[], options: LlmSynthesisOptions): string {
  const findings = selectFindings(reports, options.maxFindings);
  const reportCount = reports.length;
  const findingCount = reports.reduce((total, report) => total + report.findings.length, 0);
  const critical = findings.filter((finding) => finding.severity === "critical").length;
  const high = findings.filter((finding) => finding.severity === "high").length;
  const titles = reports.map((report) => report.title).join("; ");
  const focus = clean(options.focus);
  const audience = clean(options.audience);

  const lines = [
    `Synthesis covers ${reportCount} report${reportCount === 1 ? "" : "s"} (${titles}) with ${findingCount} finding${findingCount === 1 ? "" : "s"}.`,
    `Priority exposure: ${critical} critical and ${high} high severity finding${critical + high === 1 ? "" : "s"} in the ranked sample.`,
    `Main source summaries: ${reports.map((report) => `${report.title}: ${report.summary}`).join(" | ")}`
  ];

  if (focus) {
    lines.push(`Focus: ${focus}.`);
  }
  if (audience) {
    lines.push(`Audience: ${audience}.`);
  }

  if (findings.length) {
    lines.push(`Top signals: ${findings.map(formatFinding).join(" | ")}.`);
  } else {
    lines.push("Top signals: no ranked findings were supplied.");
  }

  const nextActions = reports.flatMap((report) => report.nextActions || []).slice(0, 5);
  if (nextActions.length) {
    lines.push(`Recommended next actions: ${nextActions.join(" | ")}.`);
  } else {
    lines.push("Recommended next actions: confirm ownership for highest-risk items and review stale or blocked work.");
  }

  return redactSecrets(lines.join("\n"));
}

function buildPrompt(reports: Report[], options: LlmSynthesisOptions): string {
  const payload = sanitizeForPrompt({
    audience: clean(options.audience) || "Azure Boards stakeholders",
    focus: clean(options.focus) || "delivery risk, decisions, process gaps, and next actions",
    reports: reports.map((report) => ({
      title: report.title,
      generatedAt: report.generatedAt,
      summary: report.summary,
      metrics: report.metrics,
      nextActions: report.nextActions,
      findings: selectFindings([report], options.maxFindings).map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        score: finding.score,
        signals: finding.signals,
        recommendation: finding.recommendation
      }))
    }))
  });

  return redactSecrets(
    [
      "Create a concise executive synthesis from Azure Boards analytics.",
      "Use only the supplied data. Do not invent work items, owners, dates, or metrics.",
      "Return 3 short paragraphs: situation, priority risks, and recommended next actions.",
      JSON.stringify(payload)
    ].join("\n\n")
  );
}

function selectFindings(reports: Report[], maxFindings?: number): Finding[] {
  return reports
    .flatMap((report) => report.findings)
    .filter((finding) => finding && typeof finding === "object")
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (b.score || 0) - (a.score || 0))
    .slice(0, clampInteger(maxFindings, 1, 20, 8));
}

function sanitizeForPrompt(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeForPrompt);
  }

  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      sanitized[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeForPrompt(nestedValue);
    }
    return sanitized;
  }

  return typeof value === "string" ? redactSecrets(value) : value;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return "";
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractResponseText(body: unknown): string {
  if (!body || typeof body !== "object") {
    return clean(body);
  }

  const outputText = (body as { output_text?: unknown }).output_text;
  if (typeof outputText === "string") {
    return clean(outputText);
  }

  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") {
        chunks.push(text);
      }
    }
  }

  return clean(chunks.join("\n"));
}

function formatFinding(finding: Finding): string {
  const id = typeof finding.id === "number" ? `#${finding.id} ` : "";
  const severity = finding.severity ? `${finding.severity} ` : "";
  const score = typeof finding.score === "number" ? `score ${finding.score}` : "unscored";
  return `${id}${finding.title} (${severity}${score})`;
}

function severityRank(severity: Finding["severity"]): number {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redactSecrets(value: unknown): string {
  return clean(String(value))
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, "$1 [REDACTED]")
    .replace(/\b[A-Za-z0-9]{52}\b/g, "[REDACTED_AZURE_PAT]")
    .replace(/("?(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|secret|pat)"?\s*[:=]\s*)"[^"\r\n]+"/gi, "$1\"[REDACTED]\"");
}
