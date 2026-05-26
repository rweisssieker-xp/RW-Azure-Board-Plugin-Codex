import type { Report } from "./types.js";
import { finding, recordArray, report, stringFrom } from "./requirementsWorkbench.js";
import { loadNamedArtifact, saveNamedArtifact, listNamedArtifacts, deleteNamedArtifact } from "./localStore.js";

const PROMPT_KIND = "prompt";
const ADMIN_KIND = "admin-config";

export function savePrompt(input: Record<string, unknown>) {
  const name = requiredString(input.name, "name");
  const prompt = requiredString(input.prompt, "prompt");
  const artifact = {
    name,
    description: stringFrom(input.description),
    inputSchema: input.inputSchema && typeof input.inputSchema === "object" ? input.inputSchema : {},
    prompt,
    allowedToolCategories: Array.isArray(input.allowedToolCategories) ? input.allowedToolCategories.map(String) : ["read-only-analysis"],
    createdAt: new Date().toISOString()
  };
  return saveNamedArtifact(PROMPT_KIND, name, artifact);
}

export function listPrompts() {
  return { kind: PROMPT_KIND, prompts: listNamedArtifacts(PROMPT_KIND) };
}

export function deletePrompt(input: Record<string, unknown>) {
  return { kind: PROMPT_KIND, name: requiredString(input.name, "name"), deleted: deleteNamedArtifact(PROMPT_KIND, requiredString(input.name, "name")) };
}

export function runPrompt(input: Record<string, unknown>): Report & { writePerformed: false; promptRun: Record<string, unknown> } {
  const name = requiredString(input.name, "name");
  const artifact = loadNamedArtifact<Record<string, unknown>>(PROMPT_KIND, name);
  if (!artifact) throw new Error(`Prompt ${name} was not found.`);
  const promptText = stringFrom(artifact.data.prompt);
  const variables = input.variables && typeof input.variables === "object" ? input.variables as Record<string, unknown> : {};
  const rendered = Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)), promptText);
  const promptRun = { name, renderedPrompt: rendered, allowedToolCategories: artifact.data.allowedToolCategories || [], writePerformed: false };
  return { ...report("Dynamic Prompt Run", [finding(undefined, name, 50, ["prompt rendered locally"], "Use rendered prompt as review input; it does not execute tools automatically.")], `Prompt ${name} rendered locally.`, { prompts: 1 }), writePerformed: false, promptRun };
}

export function getAdminConfig() {
  const artifact = loadNamedArtifact<Record<string, unknown>>(ADMIN_KIND, "default");
  return artifact || {
    kind: ADMIN_KIND,
    name: "default",
    savedAt: "",
    data: defaultAdminConfig()
  };
}

export function validateAdminConfig(input: Record<string, unknown>): Report & { writePerformed: false; validatedConfig: Record<string, unknown>; issues: Array<Record<string, unknown>> } {
  const config = input.config && typeof input.config === "object" ? input.config as Record<string, unknown> : input;
  const issues: Array<Record<string, unknown>> = [];
  const models = recordArray(config.models);
  if (!models.length) issues.push({ severity: "medium", message: "No model ranking configured; deterministic local fallback will be used." });
  for (const model of models) {
    if (/token|secret|pat|key/i.test(JSON.stringify(model))) {
      issues.push({ severity: "critical", message: "Model configuration appears to contain a secret. Store references only, never raw keys." });
    }
  }
  if (config.byodEndpoint && !/^https:\/\//i.test(String(config.byodEndpoint))) {
    issues.push({ severity: "high", message: "BYOD endpoint should use HTTPS." });
  }
  const findings = issues.map((issue, index) => finding(index + 1, String(issue.message), issue.severity === "critical" ? 95 : issue.severity === "high" ? 80 : 45, [`severity ${issue.severity}`], "Fix admin configuration before enabling hosted or private model routing."));
  return { ...report("Admin Config Validation", findings, `${issues.length} admin configuration issue(s) found.`, { issues: issues.length }), writePerformed: false, validatedConfig: { ...defaultAdminConfig(), ...config }, issues };
}

function defaultAdminConfig(): Record<string, unknown> {
  return { modelRanking: ["deterministic-local"], byodEnabled: false, privateLlmTestsEnabled: false, centralPromptsEnabled: true, secretStorage: "external-only" };
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}
