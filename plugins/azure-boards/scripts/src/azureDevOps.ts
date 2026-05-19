import { AzureBoardsAuth } from "./auth.js";
import type { WorkItem, WorkItemSummary } from "./types.js";

const API_VERSION = "7.1";
const DEFAULT_FIELDS = [
  "System.Id",
  "System.WorkItemType",
  "System.Title",
  "System.State",
  "System.AssignedTo",
  "System.CreatedDate",
  "System.ChangedDate",
  "System.Tags",
  "System.AreaPath",
  "System.IterationPath",
  "Microsoft.VSTS.Common.Priority",
  "Microsoft.VSTS.Common.Severity",
  "Microsoft.VSTS.Scheduling.DueDate",
  "Microsoft.VSTS.Common.AcceptanceCriteria",
  "System.Description"
];

export class AzureDevOpsClient {
  constructor(private readonly auth: AzureBoardsAuth) {}

  async whoami(): Promise<unknown> {
    return this.request("https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1");
  }

  async listProjects(organization: string): Promise<unknown> {
    const org = requiredString(organization, "organization");
    return this.request(this.orgUrl(org, "_apis/projects"));
  }

  async listTeams(organization: string, project: string): Promise<unknown> {
    const org = requiredString(organization, "organization");
    const projectName = requiredString(project, "project");
    return this.request(this.orgUrl(org, `_apis/projects/${encodeURIComponent(projectName)}/teams`));
  }

  async listPullRequests(organization: string, project: string, repositoryId?: string): Promise<unknown> {
    const org = requiredString(organization, "organization");
    const projectName = requiredString(project, "project");
    const repoId = optionalString(repositoryId);
    const path = repoId
      ? `_apis/git/repositories/${encodeURIComponent(repoId)}/pullrequests`
      : "_apis/git/pullrequests";
    return this.request(this.url(org, projectName, path));
  }

  async listBuilds(organization: string, project: string, top?: number): Promise<unknown> {
    const org = requiredString(organization, "organization");
    const projectName = requiredString(project, "project");
    const parsedTop = optionalPositiveInteger(top, 50);
    return this.request(`${this.url(org, projectName, "_apis/build/builds")}&$top=${parsedTop}`);
  }

  async listPipelines(organization: string, project: string): Promise<unknown> {
    const org = requiredString(organization, "organization");
    const projectName = requiredString(project, "project");
    return this.request(this.url(org, projectName, "_apis/pipelines"));
  }

  async listReleases(organization: string, project: string): Promise<unknown> {
    const org = requiredString(organization, "organization");
    const projectName = requiredString(project, "project");
    return this.request(this.releaseUrl(org, projectName, "_apis/release/releases"));
  }

  async getWorkItemComments(organization: string, project: string, id: number): Promise<unknown> {
    const org = requiredString(organization, "organization");
    const projectName = requiredString(project, "project");
    const workItemId = requiredNumber(id, "id");
    return this.request(this.url(org, projectName, `_apis/wit/workItems/${workItemId}/comments`));
  }

  async getWorkItemUpdates(organization: string, project: string, id: number): Promise<unknown> {
    const org = requiredString(organization, "organization");
    const projectName = requiredString(project, "project");
    const workItemId = requiredNumber(id, "id");
    return this.request(this.url(org, projectName, `_apis/wit/workItems/${workItemId}/updates`));
  }

  async getWorkItemRevisions(organization: string, project: string, id: number): Promise<unknown> {
    const org = requiredString(organization, "organization");
    const projectName = requiredString(project, "project");
    const workItemId = requiredNumber(id, "id");
    return this.request(this.url(org, projectName, `_apis/wit/workItems/${workItemId}/revisions`));
  }

  async listSavedQueries(organization: string, project: string, depth = 2): Promise<unknown> {
    const org = requiredString(organization, "organization");
    const projectName = requiredString(project, "project");
    const parsedDepth = Number(depth);
    const queryDepth = Number.isFinite(parsedDepth) ? Math.max(0, Math.min(Math.trunc(parsedDepth), 2)) : 2;
    return this.request(
      `${this.url(org, projectName, "_apis/wit/queries")}&$depth=${queryDepth}&$expand=${encodeURIComponent("all")}`
    );
  }

  async queryWorkItems(input: Record<string, unknown>): Promise<{ query: unknown; workItems: WorkItemSummary[] }> {
    const organization = requiredString(input.organization, "organization");
    const project = requiredString(input.project, "project");
    const wiql = requiredString(input.wiql, "wiql");
    const top = numberOrDefault(input.top, 50);
    const fields = stringArrayOrDefault(input.fields, DEFAULT_FIELDS);
    const query = await this.request<{ workItems?: Array<{ id: number }> }>(
      this.url(organization, project, "_apis/wit/wiql"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: wiql })
      }
    );
    const ids = (query.workItems || []).slice(0, top).map((item) => item.id);
    const workItems = await this.getWorkItemsByIds(organization, project, ids, fields);
    return { query, workItems: workItems.map(toSummary) };
  }

  async getWorkItem(input: Record<string, unknown>): Promise<WorkItem> {
    const organization = requiredString(input.organization, "organization");
    const project = optionalString(input.project);
    const id = requiredNumber(input.id, "id");
    const expand = optionalString(input.expand) || "relations";
    const base = project
      ? this.url(organization, project, `_apis/wit/workitems/${id}`)
      : this.orgUrl(organization, `_apis/wit/workitems/${id}`);
    return this.request<WorkItem>(`${base}&$expand=${encodeURIComponent(expand)}`);
  }

  async createWorkItem(input: Record<string, unknown>): Promise<WorkItem> {
    const organization = requiredString(input.organization, "organization");
    const project = requiredString(input.project, "project");
    const type = requiredString(input.type, "type");
    const patch = normalizePatch(input.patch, "patch");
    const segment = encodeURIComponent(type.startsWith("$") ? type : `$${type}`);
    return this.request<WorkItem>(this.url(organization, project, `_apis/wit/workitems/${segment}`), {
      method: "POST",
      headers: { "content-type": "application/json-patch+json" },
      body: JSON.stringify(patch)
    });
  }

  async updateWorkItem(input: Record<string, unknown>): Promise<WorkItem> {
    const organization = requiredString(input.organization, "organization");
    const project = requiredString(input.project, "project");
    const id = requiredNumber(input.id, "id");
    const patch = input.patch ? normalizePatch(input.patch, "patch") : buildFieldPatch(input);
    return this.request<WorkItem>(this.url(organization, project, `_apis/wit/workitems/${id}`), {
      method: "PATCH",
      headers: { "content-type": "application/json-patch+json" },
      body: JSON.stringify(patch)
    });
  }

  async addComment(input: Record<string, unknown>): Promise<unknown> {
    const organization = requiredString(input.organization, "organization");
    const project = requiredString(input.project, "project");
    const id = requiredNumber(input.id, "id");
    const text = requiredString(input.text, "text");
    return this.request(this.url(organization, project, `_apis/wit/workItems/${id}/comments`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
  }

  async getWorkItemsByIds(
    organization: string,
    project: string,
    ids: number[],
    fields = DEFAULT_FIELDS
  ): Promise<WorkItem[]> {
    if (ids.length === 0) {
      return [];
    }
    const response = await this.request<{ value: WorkItem[] }>(
      this.url(organization, project, "_apis/wit/workitemsbatch"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, fields, $expand: "relations" })
      }
    );
    return response.value || [];
  }

  private orgUrl(organization: string, path: string): string {
    return `https://dev.azure.com/${encodeURIComponent(organization)}/${path}?api-version=${API_VERSION}`;
  }

  private url(organization: string, project: string, path: string): string {
    return `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/${path}?api-version=${API_VERSION}`;
  }

  private releaseUrl(organization: string, project: string, path: string): string {
    return `https://vsrm.dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/${path}?api-version=${API_VERSION}`;
  }

  private async request<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
    const authorization = await this.auth.getAuthorizationHeader();
    const response = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        authorization,
        ...(init.headers || {})
      }
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = body?.message || body?.Message || body?.error_description || `Azure DevOps HTTP ${response.status}`;
      throw new Error(`${message}. Check login, organization/project name, and Azure DevOps permissions.`);
    }
    return body as T;
  }
}

export function toSummary(item: WorkItem): WorkItemSummary {
  const f = item.fields || {};
  return {
    id: item.id,
    type: stringField(f, "System.WorkItemType"),
    title: stringField(f, "System.Title"),
    state: stringField(f, "System.State"),
    assignedTo: identityField(f["System.AssignedTo"]),
    priority: numberField(f, "Microsoft.VSTS.Common.Priority"),
    severity: optionalString(f["Microsoft.VSTS.Common.Severity"]),
    tags: stringField(f, "System.Tags")
      .split(";")
      .map((tag) => tag.trim())
      .filter(Boolean),
    createdDate: optionalString(f["System.CreatedDate"]),
    changedDate: optionalString(f["System.ChangedDate"]),
    areaPath: optionalString(f["System.AreaPath"]),
    iterationPath: optionalString(f["System.IterationPath"]),
    url: item.url
  };
}

export function buildFieldPatch(input: Record<string, unknown>): Array<Record<string, unknown>> {
  const fields: Record<string, string> = {
    title: "/fields/System.Title",
    state: "/fields/System.State",
    assignedTo: "/fields/System.AssignedTo",
    tags: "/fields/System.Tags",
    description: "/fields/System.Description",
    acceptanceCriteria: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria",
    priority: "/fields/Microsoft.VSTS.Common.Priority"
  };
  const patch = Object.entries(fields)
    .filter(([key]) => input[key] !== undefined)
    .map(([key, path]) => ({ op: "add", path, value: input[key] }));
  if (patch.length === 0) {
    throw new Error("Provide patch or at least one supported field to update.");
  }
  return patch;
}

function normalizePatch(value: unknown, name: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be a JSON Patch array.`);
  }
  return value.map((operation, index) => {
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
      throw new Error(`${name}[${index}] must be an object.`);
    }
    const op = operation as Record<string, unknown>;
    if (!["add", "replace", "remove", "test"].includes(String(op.op))) {
      throw new Error(`${name}[${index}].op must be add, replace, remove, or test.`);
    }
    if (typeof op.path !== "string" || !op.path.startsWith("/")) {
      throw new Error(`${name}[${index}].path must be an absolute JSON Pointer.`);
    }
    return op;
  });
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function requiredNumber(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${name} must be a number.`);
  }
  return number;
}

function numberOrDefault(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(number, 200) : fallback;
}

function optionalPositiveInteger(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(Math.trunc(number), 200) : fallback;
}

function stringArrayOrDefault(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : fallback;
}

function stringField(fields: Record<string, unknown>, key: string): string {
  return optionalString(fields[key]) || "";
}

function numberField(fields: Record<string, unknown>, key: string): number | undefined {
  const value = Number(fields[key]);
  return Number.isFinite(value) ? value : undefined;
}

function identityField(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "displayName" in value) {
    return String((value as { displayName: unknown }).displayName);
  }
  return undefined;
}
