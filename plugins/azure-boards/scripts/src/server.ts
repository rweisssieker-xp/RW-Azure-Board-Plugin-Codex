import { AzureBoardsAuth } from "./auth.js";
import { AzureDevOpsClient, toSummary } from "./azureDevOps.js";
import {
  auditEvidencePack,
  bottleneckMining,
  actionPlan,
  briefExport,
  capacityForecast,
  changeImpact,
  commentIntelligence,
  costOfDelayRadar,
  createProcessBaseline,
  crossTeamBenchmark,
  decisionDebt,
  deliveryRiskRadar,
  findDuplicates,
  flowMiningFromUpdates,
  governanceScore,
  improveWorkItem,
  milestoneForecast,
  naturalLanguageToWiql,
  policyGapDetector,
  policyPackSummary,
  processDriftDetection,
  processRecommendations,
  processSimulator,
  projectCockpit,
  roleBasedReport,
  rootCausePatterns,
  scopeCreepDetector,
  slaAgingMonitor,
  statusBrief,
  watchlistReport,
  workflowConformance
} from "./analytics.js";
import type { WorkItemSummary } from "./types.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}

const auth = new AzureBoardsAuth();
const azure = new AzureDevOpsClient(auth);

const baseQuerySchema = {
  type: "object",
  properties: {
    organization: { type: "string" },
    project: { type: "string" },
    wiql: { type: "string" },
    top: { type: "number", default: 50 }
  },
  required: ["organization", "project", "wiql"]
};

const tools: ToolDef[] = [
  {
    name: "azure_boards_login",
    description: "Start individual Microsoft Entra device-code login for Azure Boards.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => auth.login()
  },
  {
    name: "azure_boards_auth_status",
    description: "Show local Azure Boards OAuth configuration and token-cache status.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => auth.status()
  },
  {
    name: "azure_boards_whoami",
    description: "Return the authenticated Azure DevOps profile.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => azure.whoami()
  },
  {
    name: "azure_boards_list_projects",
    description: "List Azure DevOps projects for an organization.",
    inputSchema: {
      type: "object",
      properties: { organization: { type: "string" } },
      required: ["organization"]
    },
    handler: async (args) => azure.listProjects(requiredString(args.organization, "organization"))
  },
  {
    name: "azure_boards_list_teams",
    description: "List teams for an Azure DevOps project.",
    inputSchema: {
      type: "object",
      properties: { organization: { type: "string" }, project: { type: "string" } },
      required: ["organization", "project"]
    },
    handler: async (args) => azure.listTeams(requiredString(args.organization, "organization"), requiredString(args.project, "project"))
  },
  {
    name: "azure_boards_get_work_item_comments",
    description: "Fetch comments for a Work Item so comment intelligence can use real discussion evidence.",
    inputSchema: workItemEvidenceSchema(),
    handler: async (args) =>
      azure.getWorkItemComments(requiredString(args.organization, "organization"), requiredString(args.project, "project"), requiredNumber(args.id, "id"))
  },
  {
    name: "azure_boards_get_work_item_updates",
    description: "Fetch Work Item update history for flow mining and process analysis.",
    inputSchema: workItemEvidenceSchema(),
    handler: async (args) =>
      azure.getWorkItemUpdates(requiredString(args.organization, "organization"), requiredString(args.project, "project"), requiredNumber(args.id, "id"))
  },
  {
    name: "azure_boards_get_work_item_revisions",
    description: "Fetch Work Item revisions for audit evidence and process history analysis.",
    inputSchema: workItemEvidenceSchema(),
    handler: async (args) =>
      azure.getWorkItemRevisions(requiredString(args.organization, "organization"), requiredString(args.project, "project"), requiredNumber(args.id, "id"))
  },
  {
    name: "azure_boards_list_saved_queries",
    description: "List saved Azure Boards queries for project discovery and reusable cockpit inputs.",
    inputSchema: {
      type: "object",
      properties: { organization: { type: "string" }, project: { type: "string" }, depth: { type: "number", default: 2 } },
      required: ["organization", "project"]
    },
    handler: async (args) =>
      azure.listSavedQueries(requiredString(args.organization, "organization"), requiredString(args.project, "project"), Number(args.depth ?? 2))
  },
  {
    name: "azure_boards_list_pull_requests",
    description: "List Azure DevOps pull requests for optional Work Item / PR risk correlation.",
    inputSchema: {
      type: "object",
      properties: { organization: { type: "string" }, project: { type: "string" }, repositoryId: { type: "string" } },
      required: ["organization", "project"]
    },
    handler: async (args) =>
      azure.listPullRequests(requiredString(args.organization, "organization"), requiredString(args.project, "project"), optionalString(args.repositoryId))
  },
  {
    name: "azure_boards_list_builds",
    description: "List Azure DevOps builds for optional Work Item / build health correlation.",
    inputSchema: {
      type: "object",
      properties: { organization: { type: "string" }, project: { type: "string" }, top: { type: "number", default: 50 } },
      required: ["organization", "project"]
    },
    handler: async (args) =>
      azure.listBuilds(requiredString(args.organization, "organization"), requiredString(args.project, "project"), Number(args.top ?? 50))
  },
  {
    name: "azure_boards_list_pipelines",
    description: "List Azure DevOps pipelines for optional delivery-system correlation.",
    inputSchema: {
      type: "object",
      properties: { organization: { type: "string" }, project: { type: "string" } },
      required: ["organization", "project"]
    },
    handler: async (args) => azure.listPipelines(requiredString(args.organization, "organization"), requiredString(args.project, "project"))
  },
  {
    name: "azure_boards_list_releases",
    description: "List Azure DevOps releases for optional release readiness correlation.",
    inputSchema: {
      type: "object",
      properties: { organization: { type: "string" }, project: { type: "string" } },
      required: ["organization", "project"]
    },
    handler: async (args) => azure.listReleases(requiredString(args.organization, "organization"), requiredString(args.project, "project"))
  },
  {
    name: "azure_boards_query_work_items",
    description: "Run WIQL and return compact Work Item results.",
    inputSchema: baseQuerySchema,
    handler: async (args) => azure.queryWorkItems(args)
  },
  {
    name: "azure_boards_get_work_item",
    description: "Fetch one Work Item by id.",
    inputSchema: {
      type: "object",
      properties: { organization: { type: "string" }, project: { type: "string" }, id: { type: "number" }, expand: { type: "string" } },
      required: ["organization", "id"]
    },
    handler: async (args) => azure.getWorkItem(args)
  },
  {
    name: "azure_boards_create_work_item",
    description: "Create a Work Item using Azure DevOps JSON Patch.",
    inputSchema: {
      type: "object",
      properties: {
        organization: { type: "string" },
        project: { type: "string" },
        type: { type: "string" },
        patch: { type: "array" }
      },
      required: ["organization", "project", "type", "patch"]
    },
    handler: async (args) => azure.createWorkItem(args)
  },
  {
    name: "azure_boards_update_work_item",
    description: "Update a Work Item using either raw JSON Patch or supported convenience fields.",
    inputSchema: {
      type: "object",
      properties: {
        organization: { type: "string" },
        project: { type: "string" },
        id: { type: "number" },
        patch: { type: "array" },
        title: { type: "string" },
        state: { type: "string" },
        assignedTo: { type: "string" },
        tags: { type: "string" },
        description: { type: "string" },
        acceptanceCriteria: { type: "string" },
        priority: { type: "number" }
      },
      required: ["organization", "project", "id"]
    },
    handler: async (args) => azure.updateWorkItem(args)
  },
  {
    name: "azure_boards_add_comment",
    description: "Add a comment to a Work Item.",
    inputSchema: {
      type: "object",
      properties: { organization: { type: "string" }, project: { type: "string" }, id: { type: "number" }, text: { type: "string" } },
      required: ["organization", "project", "id", "text"]
    },
    handler: async (args) => azure.addComment(args)
  },
  aiTool("azure_boards_ai_delivery_risk_radar", "Score delivery risks from Work Items.", deliveryRiskRadar),
  aiTool("azure_boards_ai_milestone_forecast", "Forecast milestone confidence from current board state.", milestoneForecast),
  {
    name: "azure_boards_ai_scope_creep_detector",
    description: "Compare current and previous Work Item snapshots to detect scope creep.",
    inputSchema: aiSnapshotSchema(true),
    handler: (args) => scopeCreepDetector(readItems(args), readItems({ workItems: args.previousWorkItems || [] }))
  },
  aiTool("azure_boards_ai_status_brief", "Generate an executive status brief grounded in Work Item data.", statusBrief),
  aiTool("azure_boards_ai_decision_debt", "Find unresolved decision and approval debt.", decisionDebt),
  aiTool("azure_boards_ai_bottleneck_mining", "Find process bottlenecks by state, area, and aging.", bottleneckMining),
  {
    name: "azure_boards_ai_workflow_conformance",
    description: "Check Work Items against process policy rules.",
    inputSchema: aiPolicySchema(),
    handler: (args) => workflowConformance(readItems(args), objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_sla_aging_monitor",
    description: "Find Work Items breaching SLA and aging thresholds.",
    inputSchema: aiPolicySchema({ slaDays: { type: "number", default: 14 } }),
    handler: (args) => slaAgingMonitor(readItems(args), Number(args.slaDays || 14))
  },
  aiTool("azure_boards_ai_root_cause_patterns", "Detect recurring root-cause patterns in Work Item metadata.", rootCausePatterns),
  aiTool("azure_boards_ai_process_recommendations", "Suggest concrete process improvements from board evidence.", processRecommendations),
  {
    name: "azure_boards_ai_project_cockpit",
    description: "Combine delivery, SLA, bottleneck, and governance evidence into one Project Lead / Process Owner cockpit.",
    inputSchema: aiPolicySchema(),
    handler: (args) => projectCockpit(readItems(args), objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_comment_intelligence",
    description: "Analyze supplied Work Item comments for blockers, decisions, approvals, risk, and customer impact.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, comments: { type: "array" } },
      required: ["workItems", "comments"]
    },
    handler: (args) => commentIntelligence(readItems(args), recordArrayArg(args.comments, "comments"))
  },
  {
    name: "azure_boards_ai_role_based_report",
    description: "Generate a role-specific report for Project Leads, Product Owners, Process Managers, Process Owners, QA, or executives.",
    inputSchema: {
      type: "object",
      properties: {
        workItems: { type: "array" },
        role: { type: "string", default: "executive" },
        policy: { type: "object" }
      },
      required: ["workItems"]
    },
    handler: (args) => roleBasedReport(readItems(args), { role: args.role || "executive", policy: objectArg(args.policy) })
  },
  {
    name: "azure_boards_ai_flow_mining_from_updates",
    description: "Mine Azure Boards update history for state transitions, rework, reopen churn, and workflow bottlenecks.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, updates: { type: "array" } },
      required: ["workItems"]
    },
    handler: (args) => flowMiningFromUpdates(readItems(args), recordArrayArg(args.updates || [], "updates"))
  },
  {
    name: "azure_boards_ai_policy_pack_summary",
    description: "Evaluate a multi-policy process pack for governance, SLA, and audit-readiness evidence.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, policyPack: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => policyPackSummary(readItems(args), objectArg(args.policyPack))
  },
  {
    name: "azure_boards_ai_watchlist_report",
    description: "Generate a proactive operational watchlist for stale, blocked, high-impact, unassigned, or policy-risk work.",
    inputSchema: aiPolicySchema({ maxItems: { type: "number" } }),
    handler: (args) => watchlistReport(readItems(args), { ...objectArg(args.policy), maxItems: args.maxItems })
  },
  {
    name: "azure_boards_ai_action_plan",
    description: "Convert board risks into prioritized next actions and JSON Patch previews. Does not write.",
    inputSchema: aiPolicySchema({ maxActions: { type: "number" } }),
    handler: (args) => actionPlan(readItems(args), objectArg(args.policy), { maxActions: args.maxActions })
  },
  {
    name: "azure_boards_ai_create_process_baseline",
    description: "Create a deterministic local process baseline from Work Items and optional update evidence.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, updates: { type: "array" }, policy: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => createProcessBaseline(readItems(args), recordArrayArg(args.updates || [], "updates"), objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_process_drift_detection",
    description: "Compare current Work Items with a previous process baseline and explain drift.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, baseline: { type: "object" }, policy: { type: "object" } },
      required: ["workItems", "baseline"]
    },
    handler: (args) => processDriftDetection(readItems(args), objectArg(args.baseline) as never, objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_cost_of_delay_radar",
    description: "Rank open work by estimated cost of delay, urgency, priority, blocker, and customer-impact signals.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => costOfDelayRadar(readItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_process_simulator",
    description: "Run a no-write what-if process simulation for WIP, scope, expedite, capacity, or cycle-time changes.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, scenario: { type: "object" } },
      required: ["workItems", "scenario"]
    },
    handler: (args) => processSimulator(readItems(args), objectArg(args.scenario))
  },
  {
    name: "azure_boards_ai_capacity_forecast",
    description: "Forecast delivery capacity and demand pressure from current board evidence.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => capacityForecast(readItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_brief_export",
    description: "Convert one or more AI reports into a Markdown/HTML executive, daily-risk, or audit brief.",
    inputSchema: {
      type: "object",
      properties: { report: { type: "object" }, reports: { type: "array" }, options: { type: "object" } }
    },
    handler: (args) => briefExport((Array.isArray(args.reports) ? args.reports : objectArg(args.report)) as never, objectArg(args.options))
  },
  {
    name: "azure_boards_ai_governance_score",
    description: "Score process governance quality for Process Owners.",
    inputSchema: aiPolicySchema(),
    handler: (args) => governanceScore(readItems(args), objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_policy_gap_detector",
    description: "Find policy gaps such as missing tags, wrong types, and missing ownership.",
    inputSchema: aiPolicySchema(),
    handler: (args) => policyGapDetector(readItems(args), objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_change_impact",
    description: "Estimate which Work Items would be affected by a proposed process change.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, proposedRule: { type: "string" } },
      required: ["workItems", "proposedRule"]
    },
    handler: (args) => changeImpact(readItems(args), String(args.proposedRule || "new process rule"))
  },
  aiTool("azure_boards_ai_cross_team_benchmark", "Benchmark Area Paths or teams by open volume and aging.", crossTeamBenchmark),
  {
    name: "azure_boards_ai_audit_evidence_pack",
    description: "Generate an audit evidence pack from policy gaps and SLA findings.",
    inputSchema: aiPolicySchema(),
    handler: (args) => auditEvidencePack(readItems(args), objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_improve_work_item",
    description: "Return an explainable quality-improvement patch preview for a Work Item. Does not write.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        acceptanceCriteria: { type: "string" }
      }
    },
    handler: (args) => improveWorkItem(args)
  },
  {
    name: "azure_boards_ai_nl_to_wiql",
    description: "Convert natural language into conservative WIQL. Does not execute the query.",
    inputSchema: {
      type: "object",
      properties: { project: { type: "string" }, query: { type: "string" }, request: { type: "string" } },
      required: ["project"]
    },
    handler: (args) => naturalLanguageToWiql(args)
  },
  aiTool("azure_boards_ai_find_duplicates", "Find similar or duplicate Work Items from a supplied result set.", findDuplicates)
];

function aiTool(name: string, description: string, fn: (items: WorkItemSummary[]) => unknown): ToolDef {
  return {
    name,
    description,
    inputSchema: aiSnapshotSchema(),
    handler: (args) => fn(readItems(args))
  };
}

function aiSnapshotSchema(includePrevious = false): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      workItems: { type: "array", description: "Compact Work Item summaries, for example from azure_boards_query_work_items." },
      ...(includePrevious ? { previousWorkItems: { type: "array" } } : {})
    },
    required: ["workItems"]
  };
}

function workItemEvidenceSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      organization: { type: "string" },
      project: { type: "string" },
      id: { type: "number" }
    },
    required: ["organization", "project", "id"]
  };
}

function aiPolicySchema(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const schema = aiSnapshotSchema();
  return {
    ...schema,
    properties: {
      ...(schema.properties as Record<string, unknown>),
      policy: {
        type: "object",
        properties: {
          requiredTags: { type: "array", items: { type: "string" } },
          allowedTypes: { type: "array", items: { type: "string" } }
        }
      },
      ...extra
    }
  };
}

function readItems(args: Record<string, unknown>): WorkItemSummary[] {
  const raw = args.workItems;
  if (!Array.isArray(raw)) {
    throw new Error("workItems must be an array.");
  }
  return raw.map((item) => {
    if (item && typeof item === "object" && "fields" in item && "id" in item) {
      return toSummary(item as never);
    }
    return item as WorkItemSummary;
  });
}

function objectArg(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordArrayArg(value: unknown, name: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${name}[${index}] must be an object.`);
    }
    return entry as Record<string, unknown>;
  });
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${name} must be a number.`);
  }
  return number;
}

async function handle(request: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const id = request.id;
  try {
    if (request.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "azure-boards", version: "0.1.0" }
        }
      };
    }
    if (request.method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
        }
      };
    }
    if (request.method === "tools/call") {
      const params = objectArg(request.params);
      const toolName = String(params.name || "");
      const tool = tools.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`Unknown tool ${toolName}`);
      const result = await tool.handler(objectArg(params.arguments));
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        }
      };
    }
    if (typeof request.method === "string" && request.method.startsWith("notifications/")) {
      return null;
    }
    throw new Error(`Unsupported method ${String(request.method)}`);
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline: number;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    void dispatch(line);
  }
});

async function dispatch(line: string): Promise<void> {
  const request = JSON.parse(line) as Record<string, unknown>;
  const response = await handle(request);
  if (response) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
