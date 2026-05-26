import type { Report } from "./types.js";
import { finding, normalizeItem, normalizeItems, recordArray, report, stringFrom } from "./requirementsWorkbench.js";

type InputItem = Record<string, unknown>;

export function generateMockup(input: Record<string, unknown>): Report & { writePerformed: false; mockup: Record<string, unknown> } {
  const item = normalizeItem(input.workItem && typeof input.workItem === "object" ? input.workItem as InputItem : input, 0);
  const mockup = {
    sourceWorkItemId: item.id,
    kind: "mockup",
    createdAt: new Date().toISOString(),
    format: "html",
    prompt: stringFrom(input.prompt) || item.title,
    content: `<section class="mockup"><header><h1>${escapeHtml(item.title)}</h1></header><main><label>Primary input</label><input aria-label="Primary input"><button>Submit for review</button><p>${escapeHtml(firstSentence(item.description) || "Outcome preview")}</p></main></section>`,
    assumptions: ["Mockup is a draft generated from text context.", "PNG export is handled by the local UI preview, not the MCP server."],
    writePerformed: false
  };
  return { ...report("Mockup Generator", [finding(item.id, item.title, 65, ["html mockup preview"], "Review with users before treating this as design intent.")], "One mockup preview generated.", { mockups: 1 }), writePerformed: false, mockup };
}

export function generateDiagram(input: Record<string, unknown>): Report & { writePerformed: false; diagram: Record<string, unknown> } {
  const item = normalizeItem(input.workItem && typeof input.workItem === "object" ? input.workItem as InputItem : input, 0);
  const format = /plantuml/i.test(stringFrom(input.format)) ? "plantuml" : "mermaid";
  const content = format === "plantuml"
    ? `@startuml\nactor Owner\nOwner -> System: ${safeLabel(item.title)}\nSystem --> Owner: Evidence and decision\n@enduml`
    : `flowchart TD\n  A["${safeLabel(item.title)}"] --> B["Validate input"]\n  B --> C["Execute process"]\n  C --> D["Capture evidence"]\n  D --> E["Owner decision"]`;
  const diagram = { sourceWorkItemId: item.id, kind: "diagram", createdAt: new Date().toISOString(), format, prompt: stringFrom(input.prompt) || item.title, content, assumptions: ["Diagram is generated from Work Item text and should be reviewed."], writePerformed: false };
  return { ...report("Diagram Generator", [finding(item.id, item.title, 70, [`format ${format}`], "Review and version the diagram before publishing.")], "One diagram preview generated.", { diagrams: 1 }), writePerformed: false, diagram };
}

export function generateSopDocument(input: Record<string, unknown>): Report & { writePerformed: false; document: Record<string, unknown> } {
  const items = Array.isArray(input.workItems) ? normalizeItems(input.workItems as InputItem[]) : [normalizeItem(input.workItem && typeof input.workItem === "object" ? input.workItem as InputItem : input, 0)];
  const context = recordArray(input.files).map((file) => `- ${stringFrom(file.name) || "file"}: ${firstSentence(stringFrom(file.text) || stringFrom(file.summary))}`).join("\n");
  const markdown = [
    "# Standard Operating Procedure",
    "",
    "## Purpose",
    "Define the controlled process, owner responsibilities, evidence, and exception handling.",
    "",
    "## Scope",
    ...items.map((item) => `- #${item.id} ${item.title}`),
    "",
    "## Procedure",
    "1. Confirm process owner and input data.",
    "2. Execute the process steps according to the accepted requirement.",
    "3. Record evidence, exceptions, approvals, and review date.",
    "",
    "## File Context",
    context || "- No file context supplied.",
    "",
    "## Assumptions",
    "- Draft generated from supplied Work Item and file context.",
    "- Human process owner approval required before operational use."
  ].join("\n");
  const document = { kind: "sop", createdAt: new Date().toISOString(), format: "markdown", content: markdown, sourceWorkItemIds: items.map((item) => item.id), writePerformed: false };
  return { ...report("SOP Document Generator", items.map((item) => finding(item.id, item.title, 65, ["SOP source item"], "Review SOP draft with the process owner.")), "One SOP document draft generated.", { sourceItems: items.length }), writePerformed: false, document };
}

function firstSentence(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  const match = clean.match(/^(.{1,220}?)(?:[.!?]\s|$)/);
  return (match ? match[1] : clean.slice(0, 220)).trim();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeLabel(value: string): string {
  return value.replace(/["\r\n]+/g, " ").slice(0, 80);
}
