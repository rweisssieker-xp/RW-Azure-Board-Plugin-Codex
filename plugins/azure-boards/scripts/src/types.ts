export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface WorkItem {
  id: number;
  rev?: number;
  fields: Record<string, unknown>;
  relations?: Array<Record<string, unknown>>;
  url?: string;
}

export interface WorkItemSummary {
  id: number;
  type: string;
  title: string;
  state: string;
  assignedTo?: string;
  priority?: number;
  severity?: string;
  tags: string[];
  createdDate?: string;
  changedDate?: string;
  areaPath?: string;
  iterationPath?: string;
  parentId?: number;
  url?: string;
}

export interface Finding {
  id?: number;
  title: string;
  score?: number;
  severity?: "low" | "medium" | "high" | "critical";
  signals: string[];
  recommendation: string;
}

export interface Report {
  title: string;
  generatedAt: string;
  summary: string;
  findings: Finding[];
  metrics?: Record<string, number | string>;
  nextActions?: string[];
}

export interface ToolContext {
  azure: {
    whoami(): Promise<unknown>;
    listProjects(organization: string): Promise<unknown>;
    listTeams(organization: string, project: string): Promise<unknown>;
    listPullRequests(organization: string, project: string, repositoryId?: string): Promise<unknown>;
    listBuilds(organization: string, project: string, top?: number): Promise<unknown>;
    listPipelines(organization: string, project: string): Promise<unknown>;
    listReleases(organization: string, project: string): Promise<unknown>;
    getWorkItemComments(organization: string, project: string, id: number): Promise<unknown>;
    getWorkItemUpdates(organization: string, project: string, id: number): Promise<unknown>;
    getWorkItemRevisions(organization: string, project: string, id: number): Promise<unknown>;
    listSavedQueries(organization: string, project: string, depth?: number): Promise<unknown>;
    queryWorkItems(input: Record<string, unknown>): Promise<{ query: unknown; workItems: WorkItemSummary[] }>;
    getWorkItem(input: Record<string, unknown>): Promise<WorkItem>;
    createWorkItem(input: Record<string, unknown>): Promise<WorkItem>;
    updateWorkItem(input: Record<string, unknown>): Promise<WorkItem>;
    addComment(input: Record<string, unknown>): Promise<unknown>;
  };
}
