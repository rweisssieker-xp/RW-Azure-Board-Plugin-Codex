import type { Finding, Report } from "./types.js";

type InputItem = Record<string, unknown>;

interface NormalizedItem {
  id: number;
  type: string;
  title: string;
  state: string;
  assignedTo: string;
  tags: string[];
  description: string;
  acceptanceCriteria: string;
  raw: Record<string, unknown>;
}

const REQUIREMENT_TYPES = new Set(["requirement", "user story", "feature", "epic", "product backlog item"]);

export function elicitRequirements(input: Record<string, unknown>): Report & { writePerformed: false; requirements: Array<Record<string, unknown>> } {
  const seeds = [
    ...arrayOfStrings(input.keywords),
    ...arrayOfStrings(input.notes),
    ...recordArray(input.files).map((file) => `${stringFrom(file.name)} ${stringFrom(file.text)} ${stringFrom(file.summary)}`),
    ...recordArray(input.meetings).map((meeting) => `${stringFrom(meeting.title)} ${stringFrom(meeting.notes)} ${stringFrom(meeting.transcript)}`)
  ].filter(Boolean);
  const base = seeds.length ? seeds : ["Business process improvement with measurable owner, scope, and evidence."];
  const requirements = base.slice(0, 12).map((seed, index) => {
    const title = titleFrom(seed, index);
    return {
      id: index + 1,
      title,
      problem: firstSentence(seed),
      userStory: `As a process owner, I want ${title.toLowerCase()} so that the business outcome is measurable and auditable.`,
      acceptanceCriteria: [
        "Given the responsible owner reviews the requirement, when delivery is complete, then the expected outcome is evidenced.",
        "Required source data, exception handling, and acceptance evidence are documented before closure.",
        "Business benefit and review date are recorded or explicitly marked not applicable."
      ],
      assumptions: ["Generated from supplied keywords, files, meetings, or notes.", "Requires human confirmation before creating Azure Boards work."],
      confidence: Math.min(95, 45 + seed.length / 8),
      patchPreview: [
        { op: "add", path: "/fields/System.Title", value: title },
        { op: "add", path: "/fields/System.Description", value: firstSentence(seed) },
        { op: "add", path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria", value: "Outcome, evidence, exception handling, and benefit review are defined." }
      ],
      writePerformed: false
    };
  });
  const findings = requirements.map((entry) => finding(Number(entry.id), String(entry.title), Number(entry.confidence), ["elicited requirement draft", "human confirmation required"], "Review and approve before creating a Work Item."));
  return { ...report("Requirements Elicitation Workbench", findings, `${requirements.length} requirement draft(s) elicited from supplied context.`, { requirements: requirements.length }), writePerformed: false, requirements };
}

export function requirementGapAnalysis(workItems: InputItem[], evidence: Record<string, unknown>[] = []): Report & { writePerformed: false; gaps: Array<Record<string, unknown>> } {
  const gaps = normalizeItems(workItems)
    .filter((item) => REQUIREMENT_TYPES.has(item.type.toLowerCase()))
    .map((item) => {
      const missing = [
        item.description.length < 80 ? "decision-grade description" : "",
        item.acceptanceCriteria.length < 40 ? "testable acceptance criteria" : "",
        item.assignedTo ? "" : "accountable owner",
        evidenceSignals(item, evidence).length ? "" : "supporting evidence",
        /benefit|value|saving|revenue|cost|efficiency/i.test(`${item.description} ${item.tags.join(" ")}`) ? "" : "business value statement"
      ].filter(Boolean);
      return { id: item.id, title: item.title, missing, qualityScore: Math.max(0, 100 - missing.length * 20), recommendation: missing.length ? `Clarify ${missing.join(", ")}.` : "Requirement is analysis-ready." };
    })
    .sort((a, b) => Number(a.qualityScore) - Number(b.qualityScore));
  const findings = gaps.filter((entry) => (entry.missing as string[]).length).map((entry) => finding(Number(entry.id), String(entry.title), 100 - Number(entry.qualityScore), entry.missing as string[], String(entry.recommendation)));
  return { ...report("Requirement Gap Analysis", findings, `${gaps.length} requirement(s) analyzed for quality and missing evidence.`, { analyzedRequirements: gaps.length, gaps: findings.length }), writePerformed: false, gaps };
}

export function transformWorkItemText(input: Record<string, unknown>): Report & { writePerformed: false; transforms: Array<Record<string, unknown>> } {
  const operation = stringFrom(input.operation) || "summarize";
  const language = stringFrom(input.language) || "en";
  const text = stripHtml(stringFrom(input.text) || stringFrom(input.description) || stringFrom(input.title));
  const transformed = transformText(text, operation, language);
  const transforms = [{
    operation,
    language,
    originalLength: text.length,
    transformedText: transformed,
    patchPreview: [{ op: "replace", path: "/fields/System.Description", value: transformed }],
    assumptions: ["Transformation is a draft and must be reviewed before applying."],
    writePerformed: false
  }];
  return { ...report("Work Item Text Transform", [finding(undefined, operation, 70, [`operation ${operation}`, `language ${language}`], "Review transformed text before applying a patch.")], "One Work Item text transform preview generated.", { transforms: 1 }), writePerformed: false, transforms };
}

export function convertRequirement(input: Record<string, unknown>): Report & { writePerformed: false; conversions: Array<Record<string, unknown>> } {
  const item = normalizeItem(input.workItem && typeof input.workItem === "object" ? input.workItem as InputItem : input, 0);
  const target = stringFrom(input.target) || "gherkin";
  const conversions = [{ id: item.id, title: item.title, target, content: convertContent(item, target), assumptions: ["Generated from current Work Item text only.", "Review before creating linked artifacts."], confidence: confidence(item), writePerformed: false }];
  const findings = conversions.map((entry) => finding(Number(entry.id), String(entry.title), Number(entry.confidence), [`target ${target}`], "Review conversion and approve any downstream Work Item creation separately."));
  return { ...report("Requirement Convert Workbench", findings, `Requirement converted to ${target}.`, { conversions: conversions.length }), writePerformed: false, conversions };
}

export function normalizeItems(items: InputItem[]): NormalizedItem[] {
  return items.map(normalizeItem);
}

export function normalizeItem(raw: InputItem, index = 0): NormalizedItem {
  const fields = objectFrom(raw.fields);
  const id = numberFrom(raw.id) ?? numberFrom(fields["System.Id"]) ?? index + 1;
  return {
    id,
    type: stringFrom(raw.type) || stringFrom(fields["System.WorkItemType"]) || "Work Item",
    title: stringFrom(raw.title) || stringFrom(fields["System.Title"]) || `Work Item ${id}`,
    state: stringFrom(raw.state) || stringFrom(fields["System.State"]) || "",
    assignedTo: identity(raw.assignedTo) || identity(fields["System.AssignedTo"]) || "",
    tags: tagsFrom(raw.tags ?? fields["System.Tags"]),
    description: stripHtml(stringFrom(raw.description) || stringFrom(fields["System.Description"])),
    acceptanceCriteria: stripHtml(stringFrom(raw.acceptanceCriteria) || stringFrom(fields["Microsoft.VSTS.Common.AcceptanceCriteria"])),
    raw
  };
}

export function report(title: string, findings: Finding[], summary: string, metrics: Record<string, number | string> = {}): Report {
  return { title, generatedAt: new Date().toISOString(), summary, findings: findings.sort((a, b) => (b.score || 0) - (a.score || 0)), metrics: { findings: findings.length, ...metrics }, nextActions: ["Review generated content before using it in Azure Boards.", "Apply writes only through explicit preview/apply tools."] };
}

export function finding(id: number | undefined, title: string, score: number, signals: string[], recommendation: string): Finding {
  const bounded = Math.round(Math.max(0, Math.min(100, score)));
  return { id, title: id ? `#${id} ${title}` : title, score: bounded, severity: bounded >= 85 ? "critical" : bounded >= 65 ? "high" : bounded >= 35 ? "medium" : "low", signals, recommendation };
}

export function objectFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)) : [];
}

export function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}

export function numberFrom(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function stringFrom(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function transformText(text: string, operation: string, language: string): string {
  const base = text || "No source text supplied.";
  if (/elaborate/i.test(operation)) return `${base}\n\nDetails to clarify: business problem, target outcome, evidence, exception handling, owner, and acceptance criteria.`;
  if (/paraphrase/i.test(operation)) return `Rephrased (${language}): ${firstSentence(base)} The requirement should state outcome, scope, and evidence clearly.`;
  if (/translate/i.test(operation)) return `Translation draft (${language}): ${base}`;
  return firstSentence(base).slice(0, 500);
}

function convertContent(item: NormalizedItem, target: string): string {
  if (/gherkin/i.test(target)) return `Feature: ${item.title}\n\nScenario: deliver the expected business outcome\n  Given the current process context is documented\n  When the capability is delivered\n  Then the owner can verify the outcome with evidence`;
  if (/use.?case/i.test(target)) return `Use Case: ${item.title}\nActor: ${item.assignedTo || "Business owner"}\nGoal: ${firstSentence(item.description)}\nMain Flow: Review input, execute process, validate evidence, record decision.`;
  if (/test/i.test(target)) return `Test Case: ${item.title}\nStep 1: Prepare valid input data. Expected: Data is accepted.\nStep 2: Execute the business process. Expected: Outcome is visible and evidenced.`;
  return `User Story: As a process owner, I want ${item.title.toLowerCase()} so that ${firstSentence(item.description) || "the business outcome is measurable"}.`;
}

function evidenceSignals(item: NormalizedItem, evidence: Record<string, unknown>[]): string[] {
  const signals: string[] = [];
  if (item.acceptanceCriteria) signals.push("acceptance criteria");
  if (item.tags.some((tag) => /evidence|audit|approved|validated|verified/i.test(tag))) signals.push("evidence tag");
  if (evidence.some((entry) => (numberFrom(entry.workItemId) ?? numberFrom(entry.id)) === item.id)) signals.push("supplied evidence");
  return signals;
}

function confidence(item: NormalizedItem): number {
  return Math.min(100, (item.description.length >= 80 ? 35 : 10) + (item.acceptanceCriteria.length >= 40 ? 30 : 0) + (item.assignedTo ? 15 : 0) + (item.tags.length ? 10 : 0));
}

function titleFrom(seed: string, index: number): string {
  return firstSentence(seed).replace(/[^A-Za-z0-9 ._-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || `Elicited requirement ${index + 1}`;
}

function firstSentence(value: string): string {
  const clean = stripHtml(value);
  const match = clean.match(/^(.{1,240}?)(?:[.!?]\s|$)/);
  return (match ? match[1] : clean.slice(0, 240)).trim();
}

function identity(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  const object = objectFrom(value);
  return stringFrom(object.displayName) || stringFrom(object.uniqueName) || stringFrom(object.name) || undefined;
}

function tagsFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return stringFrom(value).split(";").map((entry) => entry.trim()).filter(Boolean);
}
