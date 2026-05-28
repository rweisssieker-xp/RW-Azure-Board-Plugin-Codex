import { AzureBoardsAuth } from "./auth.js";
import { AzureDevOpsClient, toSummary } from "./azureDevOps.js";
import { planApprovedActions, summarizeApplyResults } from "./applyWorkflow.js";
import {
  attachmentEvidenceSummary,
  bulkClosePreview,
  businessValueEstimate,
  closeCandidates,
  parentChildCleanup,
  wsjfConsistencyCheck,
  type BulkClosePreview,
  type BulkCloseTarget
} from "./bulkGovernance.js";
import { deliverySystemCorrelation } from "./correlationAnalytics.js";
import {
  autonomousGovernanceAgent,
  decisionCourt,
  decisionMemory,
  recommendationQualityScore,
  requirementContractLifecycle,
  scenarioWarRoom,
  valueInflationDetector
} from "./decisionAssurance.js";
import { cioRequirementRiskView, evidenceFirstRequirementReview, requirementDecisionCockpit } from "./decisionEngine.js";
import { auditDecisionLog, boardHygieneAutomationPreview, closureGovernanceLedger, evidencePackCompleteness } from "./evidenceLedger.js";
import {
  adoptionCockpit,
  businessDigitalTwin,
  enterpriseRiskHeatmap,
  eventLogProcessMining,
  externalEvidenceImport,
  modelRiskGovernance,
  policyStudio,
  promptEvalSuite,
  roiConfidenceWorkflow,
  stakeholderInfluenceMap
} from "./enterpriseValueTrust.js";
import {
  adoptionExperimentDesigner,
  autonomousFollowupScheduler,
  connectorReadinessAudit,
  customerValueCaseBuilder,
  evidenceIngestionPipeline,
  licensePackagingAdvisor,
  marketplaceSubmissionReadiness,
  orgRolloutReadiness,
  proprietarySignalCatalog,
  securityPrivacyReview
} from "./productizationMoat.js";
import {
  adminConsoleConfig,
  aiReadinessPromptGovernance,
  approvalApplyPlan,
  approvalQueue,
  approvalResultReview,
  auditTrail,
  approvalSimulation,
  automatedReminderPlan,
  autonomousGovernanceOperatingPlan,
  boardToValueMapping,
  createPersistentBaseline,
  createPersistentSnapshot,
  complianceEvidenceScore,
  decisionKnowledgeGraph,
  decisionMemoryLearning,
  decisionPackExport,
  decisionPackImport,
  executiveSteeringRoom,
  outcomeProofEngine,
  roleCockpitConfig,
  scopeCreepRadar
} from "./productOperatingSystem.js";
import {
  aiExceptionRegister,
  autonomousBoardAuditor,
  benefitRealizationFollowup,
  cleanupCampaignManager,
  complianceReadinessReview,
  decisionMeetingCopilot,
  dependencyBlockerGraph,
  financialBacklogLedger,
  handoverPackGenerator,
  migrationCutoverReadiness,
  okrAlignmentScorer,
  operatingRhythmPlanner,
  portfolioFitnessIndex,
  processOwnerControlTower,
  requirementConfidenceScore,
  requirementRewriteStudio
} from "./governanceOperatingSystem.js";
import { synthesizeReport } from "./llmSynthesis.js";
import {
  createWatchdogSnapshot,
  deleteNamedArtifact,
  listNamedArtifacts,
  loadNamedArtifact,
  saveNamedArtifact
} from "./localStore.js";
import { authEnvironmentCheck, packageHealthCheck } from "./packageHealth.js";
import {
  deletePrompt,
  getAdminConfig,
  listPrompts,
  runPrompt,
  savePrompt,
  validateAdminConfig
} from "./promptAdmin.js";
import { validatePolicyPack } from "./policyPack.js";
import {
  convertRequirement,
  elicitRequirements,
  requirementGapAnalysis,
  transformWorkItemText
} from "./requirementsWorkbench.js";
import {
  benefitRealizationTracking,
  costAvoidanceByClosure,
  erpDomainImpactScoring,
  portfolioRationalization
} from "./portfolioEngine.js";
import { safeErrorMessage } from "./security.js";
import {
  aiBusinessCaseGenerator,
  aiSteeringCommitteePack,
  automatedBoardDueDiligenceReport,
  changePortfolioSimulator,
  decisionTraceabilityGraph,
  erpProcessCriticalityModel,
  outcomeRealizationCockpit,
  policyAsCodeEvaluation,
  requirementInvestDivestMatrix,
  valueLeakageDetector
} from "./steeringEngine.js";
import {
  applyTestCasePlan,
  generateRegressionSuite,
  generateTestCases,
  generateUatSuite
} from "./testFactory.js";
import {
  applyTraceabilityPlan,
  defectTraceability,
  requirementTestTraceability,
  testCoverageAnalysis
} from "./traceabilityEngine.js";
import {
  generateDiagram,
  generateMockup,
  generateSopDocument
} from "./visualDocumentFactory.js";
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

interface ToolAnnotations {
  readOnlyHint: boolean;
  openWorldHint: boolean;
  destructiveHint: boolean;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  outputSchema?: Record<string, unknown>;
  handler: ToolHandler;
}

const auth = new AzureBoardsAuth();
const azure = new AzureDevOpsClient(auth);
const packageRoot = process.cwd().endsWith("scripts") ? process.cwd() : `${process.cwd()}/scripts`;

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

const genericOutputSchema = {
  type: "object",
  additionalProperties: true
};

const readOnlyAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false
};

const localWriteAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: false
};

const azureWriteAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: true,
  destructiveHint: false
};

const destructiveLocalWriteAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: false,
  destructiveHint: true
};

const destructiveAzureWriteAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  openWorldHint: true,
  destructiveHint: true
};

function toolDescriptor(tool: ToolDef): Omit<ToolDef, "handler"> {
  const { handler: _handler, ...descriptor } = tool;
  return {
    ...descriptor,
    annotations: descriptor.annotations ?? readOnlyAnnotations,
    outputSchema: descriptor.outputSchema ?? genericOutputSchema
  };
}

const tools: ToolDef[] = [
  {
    name: "azure_boards_login",
    description: "Start individual Microsoft Entra device-code login for Azure Boards.",
    inputSchema: { type: "object", properties: {} },
    annotations: localWriteAnnotations,
    handler: async () => auth.login()
  },
  {
    name: "azure_boards_auth_status",
    description: "Show local Azure Boards OAuth configuration and token-cache status.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => auth.status()
  },
  {
    name: "azure_boards_package_health",
    description: "Check local plugin package health without exposing secrets.",
    inputSchema: {
      type: "object",
      properties: { root: { type: "string" } }
    },
    handler: (args) => packageHealthCheck(optionalString(args.root) || packageRoot)
  },
  {
    name: "azure_boards_auth_environment_check",
    description: "Check configured auth modes without returning token or PAT values.",
    inputSchema: { type: "object", properties: {} },
    handler: () => authEnvironmentCheck()
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
    annotations: azureWriteAnnotations,
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
    annotations: azureWriteAnnotations,
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
    annotations: azureWriteAnnotations,
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
    name: "azure_boards_ai_synthesize_report",
    description: "Optionally synthesize one or more reports with OpenAI, falling back to deterministic local synthesis when not configured.",
    inputSchema: {
      type: "object",
      properties: { report: { type: "object" }, reports: { type: "array" }, options: { type: "object" } }
    },
    handler: (args) => synthesizeReport((Array.isArray(args.reports) ? args.reports : objectArg(args.report)) as never, objectArg(args.options) as never)
  },
  {
    name: "azure_boards_validate_policy_pack",
    description: "Validate and normalize an Azure Boards policy pack. Does not write.",
    inputSchema: {
      type: "object",
      properties: { policyPack: { type: "object" } },
      required: ["policyPack"]
    },
    handler: (args) => validatePolicyPack(objectArg(args.policyPack))
  },
  {
    name: "azure_boards_ai_plan_approved_actions",
    description: "Turn an AI Action Plan into approved patch batches. Requires explicit approved:true and does not call Azure DevOps.",
    inputSchema: {
      type: "object",
      properties: { actionPlanReport: { type: "object" }, selection: { type: "object" } },
      required: ["actionPlanReport"]
    },
    handler: (args) => planApprovedActions(objectArg(args.actionPlanReport) as never, objectArg(args.selection) as never)
  },
  {
    name: "azure_boards_ai_summarize_apply_results",
    description: "Summarize apply or planned-apply results without exposing secrets.",
    inputSchema: {
      type: "object",
      properties: { results: { type: "array" } },
      required: ["results"]
    },
    handler: (args) => summarizeApplyResults(recordArrayArg(args.results, "results") as never)
  },
  {
    name: "azure_boards_ai_close_candidates",
    description: "Find close candidates from Work Item evidence using stale age, weak Description, low priority, and low WSJF. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => closeCandidates(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_wsjf_consistency_check",
    description: "Check WSJF fields against Description, state, priority, and business-risk signals. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" } }, required: ["workItems"] },
    handler: (args) => wsjfConsistencyCheck(readRawItems(args))
  },
  {
    name: "azure_boards_ai_business_value_estimate",
    description: "Estimate annual EUR-denominated benefit ranges from Description, WSJF, state, priority, and business signals. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" } }, required: ["workItems"] },
    handler: (args) => businessValueEstimate(readRawItems(args))
  },
  {
    name: "azure_boards_ai_attachment_evidence_summary",
    description: "Summarize attachment evidence from Work Item relations and optional extracted attachment text snippets. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, attachmentTexts: { type: "array" } },
      required: ["workItems"]
    },
    handler: (args) => attachmentEvidenceSummary(readRawItems(args), recordArrayArg(args.attachmentTexts || [], "attachmentTexts"))
  },
  {
    name: "azure_boards_ai_parent_child_cleanup",
    description: "Find open Tasks whose parent Requirement is already terminal. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" } }, required: ["workItems"] },
    handler: (args) => parentChildCleanup(readRawItems(args))
  },
  {
    name: "azure_boards_ai_bulk_close_preview",
    description: "Create an auditable bulk-close plan with target states, comments, patch previews, child impact, skipped items, and approval requirement. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => bulkClosePreview(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_apply_bulk_close_plan",
    description: "Apply an explicitly approved bulk-close preview by adding comments then updating states. Requires approved:true and confirmPhrase APPLY_BULK_CLOSE.",
    inputSchema: {
      type: "object",
      properties: {
        organization: { type: "string" },
        project: { type: "string" },
        preview: { type: "object" },
        approved: { type: "boolean" },
        confirmPhrase: { type: "string" }
      },
      required: ["organization", "project", "preview", "approved", "confirmPhrase"]
    },
    annotations: destructiveAzureWriteAnnotations,
    handler: (args) => applyBulkClosePlan(args)
  },
  {
    name: "azure_boards_ai_delivery_system_correlation",
    description: "Correlate Work Items with PR, build, pipeline, and release evidence.",
    inputSchema: {
      type: "object",
      properties: {
        workItems: { type: "array" },
        evidence: { type: "object" },
        options: { type: "object" }
      },
      required: ["workItems"]
    },
    handler: (args) => deliverySystemCorrelation(readItems(args), objectArg(args.evidence), objectArg(args.options) as never)
  },
  {
    name: "azure_boards_ai_requirement_decision_cockpit",
    description: "Score Requirements for accelerate, review, park, or close decisions using evidence, value, risk, priority, and stale signals. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => requirementDecisionCockpit(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_evidence_first_requirement_review",
    description: "Review Requirements against Description, acceptance criteria, attachments, and supplied evidence before decisions. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, evidence: { type: "array" } },
      required: ["workItems"]
    },
    handler: (args) => evidenceFirstRequirementReview(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"))
  },
  {
    name: "azure_boards_ai_cio_requirement_risk_view",
    description: "Create a CIO-facing risk view for stale, unowned, regulated, high-priority, or weak-evidence Requirements. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => cioRequirementRiskView(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_portfolio_rationalization",
    description: "Classify portfolio work as keep, kill, merge, or rework using value, effort, stale age, duplicate, and ERP-domain signals. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => portfolioRationalization(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_benefit_realization_tracking",
    description: "Track expected versus realized benefits and expose unrealized benefit gaps. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => benefitRealizationTracking(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_cost_avoidance_by_closure",
    description: "Estimate deterministic cost avoidance from closed, removed, or de-scoped work. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => costAvoidanceByClosure(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_erp_domain_impact_scoring",
    description: "Score Work Items by ERP business domains such as Finance, Production, Compliance, Integration, Customer, Master Data, and Automation. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => erpDomainImpactScoring(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_closure_governance_ledger",
    description: "Build a no-write closure ledger for terminal Work Items with closure actor, date, evidence, and missing governance signals.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, updates: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => closureGovernanceLedger(readRawItems(args), recordArrayArg(args.updates || [], "updates"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_audit_decision_log",
    description: "Derive an audit decision log from Work Item fields and supplied comments, updates, or evidence records. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => auditDecisionLog(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_board_hygiene_automation_preview",
    description: "Preview board hygiene actions for missing owner, stale item, missing acceptance criteria, missing evidence, or terminal-parent children. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => boardHygieneAutomationPreview(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_evidence_pack_completeness",
    description: "Score Work Items for audit evidence pack completeness against configurable evidence requirements. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => evidencePackCompleteness(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_outcome_realization_cockpit",
    description: "Compare expected versus realized benefits and expose outcome gaps. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => outcomeRealizationCockpit(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_business_case_generator",
    description: "Generate draft business cases from Description, benefit, cost, ERP process, risk, and evidence signals. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => aiBusinessCaseGenerator(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_value_leakage_detector",
    description: "Detect value leakage from stale open work, missing owners, weak evidence, or closed items without realized benefit. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => valueLeakageDetector(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_decision_traceability_graph",
    description: "Build a no-write graph of Work Items, parent/child links, attachments, evidence, and decision nodes.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, evidence: { type: "array" } },
      required: ["workItems"]
    },
    handler: (args) => decisionTraceabilityGraph(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"))
  },
  {
    name: "azure_boards_ai_erp_process_criticality_model",
    description: "Score Work Items against ERP process criticality areas: Finance Closing, Order-to-Cash, Procure-to-Pay, Manufacturing, Warehouse, Master Data, Regulatory, and Integration Backbone.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => erpProcessCriticalityModel(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_board_due_diligence_report",
    description: "Create a CIO due-diligence report combining outcome realization, value leakage, ERP criticality, and traceability gaps. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => automatedBoardDueDiligenceReport(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_requirement_invest_divest_matrix",
    description: "Place Requirements into invest, steering-decision, bundle, or divest quadrants from benefit and cost signals. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => requirementInvestDivestMatrix(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_change_portfolio_simulator",
    description: "Simulate portfolio effects of closing/removing selected Work Items, including freed cost, lost benefit, and domain coverage. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => changePortfolioSimulator(readRawItems(args), objectArg(args.options) as never)
  },
  {
    name: "azure_boards_ai_steering_committee_pack",
    description: "Generate a no-write Markdown/optional HTML steering pack from Work Items and optional source reports.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, reports: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => aiSteeringCommitteePack(readRawItems(args), recordArrayArg(args.reports || [], "reports") as never, objectArg(args.options))
  },
  {
    name: "azure_boards_ai_policy_as_code_evaluation",
    description: "Evaluate Work Items against versionable policy-as-code controls for required tags, fields, owner, stale age, and evidence. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, policy: { type: "object" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => policyAsCodeEvaluation(readRawItems(args), objectArg(args.policy), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_autonomous_board_auditor",
    description: "Run a no-write autonomous audit for owner, Description, acceptance, stale, and benefit evidence gaps.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => autonomousBoardAuditor(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_requirement_rewrite_studio",
    description: "Generate better Requirement Description and Acceptance Criteria patch previews. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" } }, required: ["workItems"] },
    handler: (args) => requirementRewriteStudio(readRawItems(args))
  },
  {
    name: "azure_boards_ai_decision_meeting_copilot",
    description: "Prepare a decision meeting agenda and minutes draft from Work Item evidence. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" } }, required: ["workItems"] },
    handler: (args) => decisionMeetingCopilot(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"))
  },
  {
    name: "azure_boards_ai_cleanup_campaign_manager",
    description: "Plan board cleanup campaigns such as low-value, missing-description, orphan-task, or closed-evidence campaigns. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => cleanupCampaignManager(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_financial_backlog_ledger",
    description: "Create a financial ledger with expected benefit, realized benefit, implementation cost, delay cost, and net value. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => financialBacklogLedger(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_requirement_confidence_score",
    description: "Score whether Requirements are ready, need clarification, or are not investable. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" } }, required: ["workItems"] },
    handler: (args) => requirementConfidenceScore(readRawItems(args))
  },
  {
    name: "azure_boards_ai_dependency_blocker_graph",
    description: "Build a no-write dependency and blocker graph from parent/child links, artifacts, comments, and risk terms.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, comments: { type: "array" } }, required: ["workItems"] },
    handler: (args) => dependencyBlockerGraph(readRawItems(args), recordArrayArg(args.comments || [], "comments"))
  },
  {
    name: "azure_boards_ai_process_owner_control_tower",
    description: "Create a Process Owner control tower across Area Paths with governance score, open work, and policy gaps. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, policy: { type: "object" } }, required: ["workItems"] },
    handler: (args) => processOwnerControlTower(readRawItems(args), objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_migration_cutover_readiness",
    description: "Score ERP migration cutover readiness with Go/Conditional-Go/No-Go signals from open critical work, missing evidence, and blockers.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => migrationCutoverReadiness(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_exception_register",
    description: "Detect exception, waiver, or deferred-decision candidates and produce an audit-ready exception register. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" } }, required: ["workItems"] },
    handler: (args) => aiExceptionRegister(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"))
  },
  {
    name: "azure_boards_ai_benefit_realization_followup",
    description: "Find closed high-benefit items that need realized-benefit follow-up after a configurable lag. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => benefitRealizationFollowup(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_operating_rhythm_planner",
    description: "Plan daily, weekly, monthly, and quarterly governance cadences from board evidence. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => operatingRhythmPlanner(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_okr_alignment_scorer",
    description: "Score Work Items against strategic objectives or OKRs and flag unaligned work. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => okrAlignmentScorer(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_compliance_readiness_review",
    description: "Review regulatory, audit, security, or compliance work for owner, acceptance, evidence, and exception controls. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, policy: { type: "object" } }, required: ["workItems"] },
    handler: (args) => complianceReadinessReview(readRawItems(args), objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_handover_pack_generator",
    description: "Generate a board-evidence handover pack for Process Owners, Project Leads, or incoming owners. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => handoverPackGenerator(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_portfolio_fitness_index",
    description: "Compute a portfolio fitness score from stale work, owner gaps, weak requirements, benefit, and estimated cost. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => portfolioFitnessIndex(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_elicit_requirements",
    description: "Elicit Requirement drafts from keywords, notes, meetings, and file context. Does not write.",
    inputSchema: { type: "object", properties: { keywords: { type: "array" }, notes: { type: "array" }, files: { type: "array" }, meetings: { type: "array" } } },
    handler: (args) => elicitRequirements(args)
  },
  {
    name: "azure_boards_ai_requirement_gap_analysis",
    description: "Analyze Requirements for missing owner, evidence, acceptance criteria, and business value. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" } }, required: ["workItems"] },
    handler: (args) => requirementGapAnalysis(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"))
  },
  {
    name: "azure_boards_ai_transform_work_item_text",
    description: "Preview summarize, elaborate, paraphrase, or translate transformations for Work Item text. Does not write.",
    inputSchema: { type: "object", properties: { title: { type: "string" }, text: { type: "string" }, description: { type: "string" }, operation: { type: "string" }, language: { type: "string" } } },
    handler: (args) => transformWorkItemText(args)
  },
  {
    name: "azure_boards_ai_convert_requirement",
    description: "Convert a Requirement into Gherkin, Use Case, User Story, or Test Case draft. Does not write.",
    inputSchema: { type: "object", properties: { workItem: { type: "object" }, target: { type: "string" } } },
    handler: (args) => convertRequirement(args)
  },
  {
    name: "azure_boards_ai_generate_test_cases",
    description: "Generate Azure Test Case previews with steps, expected results, assumptions, confidence, and patch previews. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => generateTestCases(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_generate_uat_suite",
    description: "Generate UAT scripts from Requirements and business evidence. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => generateUatSuite(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_generate_regression_suite",
    description: "Generate regression suite candidates from Requirement risk and process signals. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => generateRegressionSuite(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_requirement_test_traceability",
    description: "Preview Requirement to Test Case traceability links. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, testCases: { type: "array" } }, required: ["workItems"] },
    handler: (args) => requirementTestTraceability(readRawItems(args), recordArrayArg(args.testCases || [], "testCases"))
  },
  {
    name: "azure_boards_ai_test_coverage_analysis",
    description: "Analyze missing, stale, or duplicate test coverage for Requirements. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, testCases: { type: "array" } }, required: ["workItems"] },
    handler: (args) => testCoverageAnalysis(readRawItems(args), recordArrayArg(args.testCases || [], "testCases"))
  },
  {
    name: "azure_boards_ai_defect_traceability",
    description: "Analyze Defect to Requirement to Test Result traceability chains. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, defects: { type: "array" }, testResults: { type: "array" } }, required: ["workItems"] },
    handler: (args) => defectTraceability(readRawItems(args), recordArrayArg(args.defects || [], "defects"), recordArrayArg(args.testResults || [], "testResults"))
  },
  {
    name: "azure_boards_ai_generate_mockup",
    description: "Generate a local mockup preview from Work Item text or file context. Does not write.",
    inputSchema: { type: "object", properties: { workItem: { type: "object" }, title: { type: "string" }, description: { type: "string" }, prompt: { type: "string" } } },
    handler: (args) => generateMockup(args)
  },
  {
    name: "azure_boards_ai_generate_diagram",
    description: "Generate Mermaid or PlantUML diagram text from Work Item context. Does not write.",
    inputSchema: { type: "object", properties: { workItem: { type: "object" }, title: { type: "string" }, description: { type: "string" }, prompt: { type: "string" }, format: { type: "string" } } },
    handler: (args) => generateDiagram(args)
  },
  {
    name: "azure_boards_ai_generate_sop_document",
    description: "Generate a SOP document draft from Work Items and optional file context. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, workItem: { type: "object" }, files: { type: "array" } } },
    handler: (args) => generateSopDocument(args)
  },
  {
    name: "azure_boards_prompt_save",
    description: "Save a local dynamic prompt artifact. Does not call Azure DevOps.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, inputSchema: { type: "object" }, prompt: { type: "string" }, allowedToolCategories: { type: "array" } }, required: ["name", "prompt"] },
    annotations: localWriteAnnotations,
    handler: (args) => savePrompt(args)
  },
  {
    name: "azure_boards_prompt_list",
    description: "List local dynamic prompt artifacts.",
    inputSchema: { type: "object", properties: {} },
    handler: () => listPrompts()
  },
  {
    name: "azure_boards_prompt_run",
    description: "Render a saved dynamic prompt locally without executing tools.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, variables: { type: "object" } }, required: ["name"] },
    handler: (args) => runPrompt(args)
  },
  {
    name: "azure_boards_prompt_delete",
    description: "Delete a local dynamic prompt artifact.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    annotations: destructiveLocalWriteAnnotations,
    handler: (args) => deletePrompt(args)
  },
  {
    name: "azure_boards_admin_get_config",
    description: "Return the local default admin configuration without secrets.",
    inputSchema: { type: "object", properties: {} },
    handler: () => getAdminConfig()
  },
  {
    name: "azure_boards_admin_validate_config",
    description: "Validate admin model routing, BYOD, private LLM, and prompt configuration without storing secrets.",
    inputSchema: { type: "object", properties: { config: { type: "object" } } },
    handler: (args) => validateAdminConfig(args)
  },
  {
    name: "azure_boards_apply_test_case_plan",
    description: "Apply an explicitly approved Test Case plan by creating Azure Boards Test Case Work Items.",
    inputSchema: { type: "object", properties: { organization: { type: "string" }, project: { type: "string" }, plan: { type: "object" }, approved: { type: "boolean" }, confirmPhrase: { type: "string" } }, required: ["organization", "project", "plan", "approved", "confirmPhrase"] },
    annotations: azureWriteAnnotations,
    handler: (args) => applyTestCasePlan(args, azure)
  },
  {
    name: "azure_boards_apply_traceability_plan",
    description: "Apply an explicitly approved Requirement to Test Case traceability link plan.",
    inputSchema: { type: "object", properties: { organization: { type: "string" }, project: { type: "string" }, plan: { type: "object" }, approved: { type: "boolean" }, confirmPhrase: { type: "string" } }, required: ["organization", "project", "plan", "approved", "confirmPhrase"] },
    annotations: azureWriteAnnotations,
    handler: (args) => applyTraceabilityPlan(args, azure)
  },
  {
    name: "azure_boards_ai_decision_memory",
    description: "Assemble an audit-ready memory of decisions, rationale, owners, and later outcomes. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, decisions: { type: "array" }, outcomes: { type: "array" } }, required: ["workItems"] },
    handler: (args) => decisionMemory(readRawItems(args), recordArrayArg(args.decisions || [], "decisions"), recordArrayArg(args.outcomes || [], "outcomes"))
  },
  {
    name: "azure_boards_ai_recommendation_quality_score",
    description: "Score previous recommendations against supplied outcomes and learning signals. Does not write.",
    inputSchema: { type: "object", properties: { recommendations: { type: "array" }, outcomes: { type: "array" } } },
    handler: (args) => recommendationQualityScore(recordArrayArg(args.recommendations || [], "recommendations"), recordArrayArg(args.outcomes || [], "outcomes"))
  },
  {
    name: "azure_boards_ai_value_inflation_detector",
    description: "Detect inflated Business Value, WSJF, or Cost-of-Delay claims with weak evidence. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => valueInflationDetector(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_decision_court",
    description: "Prepare pro, contra, missing facts, confidence, and verdict for Close/Keep/Build recommendations. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, recommendations: { type: "array" } }, required: ["workItems"] },
    handler: (args) => decisionCourt(readRawItems(args), recordArrayArg(args.recommendations || [], "recommendations"))
  },
  {
    name: "azure_boards_ai_requirement_contract_lifecycle",
    description: "Generate measurable requirement outcome contracts with metric, baseline, target, owner, review cadence, and patch preview. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => requirementContractLifecycle(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_scenario_war_room",
    description: "Simulate management scenarios such as budget cuts, fixed go-live, compliance priority, and scope pressure. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, scenarios: { type: "array" } }, required: ["workItems"] },
    handler: (args) => scenarioWarRoom(readRawItems(args), recordArrayArg(args.scenarios || [], "scenarios"))
  },
  {
    name: "azure_boards_ai_autonomous_governance_agent",
    description: "Prepare recurring governance watchlists, meeting agendas, and action previews without applying writes.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => autonomousGovernanceAgent(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_business_digital_twin",
    description: "Map Work Items to external business KPI evidence and impact confidence. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => businessDigitalTwin(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_external_evidence_import",
    description: "Normalize CSV, ERP, support, finance, incident, or KPI evidence records for board decisions. Does not write.",
    inputSchema: { type: "object", properties: { records: { type: "array" }, options: { type: "object" } } },
    handler: (args) => externalEvidenceImport(recordArrayArg(args.records || [], "records"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_event_log_process_mining",
    description: "Mine imported event logs for process transitions and bottlenecks outside Azure Boards. Does not write.",
    inputSchema: { type: "object", properties: { events: { type: "array" }, options: { type: "object" } } },
    handler: (args) => eventLogProcessMining(recordArrayArg(args.events || [], "events"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_stakeholder_influence_map",
    description: "Map stakeholders, owners, blockers, beneficiaries, and influence edges for Work Items. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, stakeholders: { type: "array" } }, required: ["workItems"] },
    handler: (args) => stakeholderInfluenceMap(readRawItems(args), recordArrayArg(args.stakeholders || [], "stakeholders"))
  },
  {
    name: "azure_boards_ai_roi_confidence_workflow",
    description: "Classify ROI maturity from rough estimate through evidence-backed, finance-reviewed, and realized. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, financeEvidence: { type: "array" } }, required: ["workItems"] },
    handler: (args) => roiConfidenceWorkflow(readRawItems(args), recordArrayArg(args.financeEvidence || [], "financeEvidence"))
  },
  {
    name: "azure_boards_ai_enterprise_risk_heatmap",
    description: "Aggregate delivery, compliance, finance, test, and ownership risks into an enterprise heatmap. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, signals: { type: "array" } }, required: ["workItems"] },
    handler: (args) => enterpriseRiskHeatmap(readRawItems(args), recordArrayArg(args.signals || [], "signals"))
  },
  {
    name: "azure_boards_ai_policy_studio",
    description: "Draft and simulate governance policies before adding them to policy packs. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, policy: { type: "object" } }, required: ["workItems"] },
    handler: (args) => policyStudio(readRawItems(args), objectArg(args.policy))
  },
  {
    name: "azure_boards_ai_prompt_eval_suite",
    description: "Evaluate saved or supplied prompts against no-write, stability, and assumption expectations. Does not write.",
    inputSchema: { type: "object", properties: { prompts: { type: "array" }, cases: { type: "array" } } },
    handler: (args) => promptEvalSuite(recordArrayArg(args.prompts || [], "prompts"), recordArrayArg(args.cases || [], "cases"))
  },
  {
    name: "azure_boards_ai_model_risk_governance",
    description: "Evaluate model routing, data classes, and private/public LLM risk. Does not write.",
    inputSchema: { type: "object", properties: { config: { type: "object" }, dataClasses: { type: "array" } } },
    handler: (args) => modelRiskGovernance(objectArg(args.config), recordArrayArg(args.dataClasses || [], "dataClasses"))
  },
  {
    name: "azure_boards_ai_adoption_cockpit",
    description: "Assess team adoption, active users, prompt usage, and approved preview usage. Does not write.",
    inputSchema: { type: "object", properties: { usage: { type: "array" }, workItems: { type: "array" } } },
    handler: (args) => adoptionCockpit(recordArrayArg(args.usage || [], "usage"), Array.isArray(args.workItems) ? readRawItems(args) : [])
  },
  {
    name: "azure_boards_ai_connector_readiness_audit",
    description: "Assess enterprise connector readiness for Azure Test Plans, Power BI/Fabric, ERP, Teams, SharePoint, monitoring, and related integrations. Does not write.",
    inputSchema: { type: "object", properties: { connectors: { type: "array" }, options: { type: "object" } } },
    handler: (args) => connectorReadinessAudit(recordArrayArg(args.connectors || [], "connectors"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_evidence_ingestion_pipeline",
    description: "Normalize uploaded or external evidence metadata into linkable, non-persisted decision context. Does not write.",
    inputSchema: { type: "object", properties: { records: { type: "array" }, options: { type: "object" } } },
    handler: (args) => evidenceIngestionPipeline(recordArrayArg(args.records || [], "records"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_security_privacy_review",
    description: "Review enterprise security, privacy, tenant isolation, RBAC, audit-log, retention, and redaction readiness. Does not write.",
    inputSchema: { type: "object", properties: { config: { type: "object" }, dataFlows: { type: "array" } } },
    handler: (args) => securityPrivacyReview(objectArg(args.config), recordArrayArg(args.dataFlows || [], "dataFlows"))
  },
  {
    name: "azure_boards_ai_marketplace_submission_readiness",
    description: "Check Marketplace/App Directory readiness including privacy, terms, support, screenshots, hosted MCP, annotations, and extension package evidence. Does not write.",
    inputSchema: { type: "object", properties: { submission: { type: "object" }, assets: { type: "array" } } },
    handler: (args) => marketplaceSubmissionReadiness(objectArg(args.submission), recordArrayArg(args.assets || [], "assets"))
  },
  {
    name: "azure_boards_ai_org_rollout_readiness",
    description: "Score organization rollout readiness across sponsor, admin consent, pilot scope, support owner, training, and team readiness. Does not write.",
    inputSchema: { type: "object", properties: { orgConfig: { type: "object" }, teams: { type: "array" } } },
    handler: (args) => orgRolloutReadiness(objectArg(args.orgConfig), recordArrayArg(args.teams || [], "teams"))
  },
  {
    name: "azure_boards_ai_license_packaging_advisor",
    description: "Recommend commercial edition packaging and feature gates from usage, approval, and governance signals. Does not write.",
    inputSchema: { type: "object", properties: { usage: { type: "array" }, options: { type: "object" } } },
    handler: (args) => licensePackagingAdvisor(recordArrayArg(args.usage || [], "usage"), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_customer_value_case_builder",
    description: "Draft customer value cases and annual value assumptions from Work Items and linked evidence. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" } }, required: ["workItems"] },
    handler: (args) => customerValueCaseBuilder(readRawItems(args), recordArrayArg(args.evidence || [], "evidence"))
  },
  {
    name: "azure_boards_ai_proprietary_signal_catalog",
    description: "Catalog data-moat signals such as labeled requirement quality, value mismatch, closure evidence, feedback labels, and connector-specific patterns. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, feedback: { type: "array" }, evidence: { type: "array" } }, required: ["workItems"] },
    handler: (args) => proprietarySignalCatalog(readRawItems(args), recordArrayArg(args.feedback || [], "feedback"), recordArrayArg(args.evidence || [], "evidence"))
  },
  {
    name: "azure_boards_ai_autonomous_followup_scheduler",
    description: "Prepare no-write follow-up recommendations for stale, risky, unowned, or decision-heavy Work Items. Does not schedule or send.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => autonomousFollowupScheduler(readRawItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_ai_adoption_experiment_designer",
    description: "Design measured adoption experiments with hypotheses, baselines, metrics, duration, and guardrails. Does not write.",
    inputSchema: { type: "object", properties: { usage: { type: "array" }, teams: { type: "array" }, options: { type: "object" } } },
    handler: (args) => adoptionExperimentDesigner(recordArrayArg(args.usage || [], "usage"), recordArrayArg(args.teams || [], "teams"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_snapshot_save",
    description: "Persist a product-grade process snapshot with baseline, watchlist, role summaries, and fingerprint in the user-local store.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } },
      required: ["name", "workItems"]
    },
    annotations: localWriteAnnotations,
    handler: (args) => createPersistentSnapshot(requiredString(args.name, "name"), readItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_baseline_save",
    description: "Persist a named process baseline for later drift comparison in the user-local store.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, workItems: { type: "array" }, updates: { type: "array" }, policy: { type: "object" } },
      required: ["name", "workItems"]
    },
    annotations: localWriteAnnotations,
    handler: (args) => createPersistentBaseline(requiredString(args.name, "name"), readItems(args), recordArrayArg(args.updates || [], "updates"), objectArg(args.policy))
  },
  {
    name: "azure_boards_product_approval_queue",
    description: "Build a no-write approval queue from recommendations or generated action-plan items, including selection defaults and verification steps.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, recommendations: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => approvalQueue(readItems(args), recordArrayArg(args.recommendations || [], "recommendations"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_approval_apply_plan",
    description: "Turn selected, rejected, or overridden approval queue rows into an auditable no-write apply plan with verification steps.",
    inputSchema: {
      type: "object",
      properties: { queue: { type: "array" }, selection: { type: "object" }, options: { type: "object" } },
      required: ["queue"]
    },
    handler: (args) => approvalApplyPlan(recordArrayArg(args.queue || [], "queue"), objectArg(args.selection), objectArg(args.options))
  },
  {
    name: "azure_boards_product_approval_result_review",
    description: "Review apply results against an approval apply plan and current Work Items, producing verification and audit events. Does not write.",
    inputSchema: {
      type: "object",
      properties: { plan: { type: "array" }, results: { type: "array" }, workItems: { type: "array" } },
      required: ["plan", "results", "workItems"]
    },
    handler: (args) => approvalResultReview(recordArrayArg(args.plan || [], "plan"), recordArrayArg(args.results || [], "results"), readItems(args))
  },
  {
    name: "azure_boards_product_audit_trail",
    description: "Normalize accepted, rejected, or overridden recommendation events into an audit trail. Does not write.",
    inputSchema: {
      type: "object",
      properties: { events: { type: "array" }, options: { type: "object" } }
    },
    handler: (args) => auditTrail(recordArrayArg(args.events || [], "events"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_role_cockpits",
    description: "Generate role-specific cockpit configurations for Product Owner, Scrum Master, CIO, and Compliance views. Does not write.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, roleConfig: { type: "object" }, policy: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => roleCockpitConfig(readItems(args), objectArg(args.roleConfig), objectArg(args.policy))
  },
  {
    name: "azure_boards_product_admin_console",
    description: "Normalize production admin settings for policies, thresholds, risk weights, data classes, LLM mode, hosted MCP, and OAuth readiness. Does not write.",
    inputSchema: { type: "object", properties: { config: { type: "object" } } },
    handler: (args) => adminConsoleConfig(objectArg(args.config))
  },
  {
    name: "azure_boards_product_reminder_plan",
    description: "Prepare no-write recurring reminder recommendations for watchlists and benefit realization follow-ups.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    handler: (args) => automatedReminderPlan(readItems(args), objectArg(args.options))
  },
  {
    name: "azure_boards_product_decision_pack_export",
    description: "Export steering, handover, and operating rhythm content as a Decision Pack with Markdown and JSON artifacts. Optionally persists locally.",
    inputSchema: {
      type: "object",
      properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } },
      required: ["workItems"]
    },
    annotations: localWriteAnnotations,
    handler: (args) => decisionPackExport(readItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_decision_pack_import",
    description: "Validate and normalize an imported Decision Pack artifact before review or storage. Does not write.",
    inputSchema: {
      type: "object",
      properties: { artifact: { type: "object" } },
      required: ["artifact"]
    },
    handler: (args) => decisionPackImport(objectArg(args.artifact))
  },
  {
    name: "azure_boards_product_outcome_proof_engine",
    description: "Prove whether delivered Work Items produced the expected outcome value by comparing benefits, ROI evidence, and leakage risk. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => outcomeProofEngine(readItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_decision_memory_learning",
    description: "Learn from past accepted, rejected, overridden, and observed decisions to expose recommendation quality and repeated decision patterns. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, decisions: { type: "array" }, outcomes: { type: "array" } }, required: ["workItems"] },
    handler: (args) => decisionMemoryLearning(readItems(args), recordArrayArg(args.decisions || [], "decisions"), recordArrayArg(args.outcomes || [], "outcomes"))
  },
  {
    name: "azure_boards_product_board_to_value_mapping",
    description: "Map Azure Boards Work Items to business value, KPI evidence, ROI confidence, and value leakage. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => boardToValueMapping(readItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_autonomous_governance_plan",
    description: "Prepare recurring governance watchlists, audit packs, meeting prompts, and follow-up plans without scheduling or applying writes.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => autonomousGovernanceOperatingPlan(readItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_compliance_evidence_score",
    description: "Score whether requirements have sufficient owners, approvals, evidence, and model/data controls for compliance review. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" }, policy: { type: "object" } }, required: ["workItems"] },
    handler: (args) => complianceEvidenceScore(readItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.policy))
  },
  {
    name: "azure_boards_product_scope_creep_radar",
    description: "Detect unapproved scope growth by comparing current and previous snapshots and simulating capacity/value impact. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, previousWorkItems: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => scopeCreepRadar(readItems(args), readItems({ workItems: args.previousWorkItems || [] }), objectArg(args.options))
  },
  {
    name: "azure_boards_product_approval_simulation",
    description: "Simulate approval impact before applying changes, including selected recommendations, affected owners, risks, and verification steps. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, recommendations: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => approvalSimulation(readItems(args), recordArrayArg(args.recommendations || [], "recommendations"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_executive_steering_room",
    description: "Create an executive approve, park, kill, or escalate cockpit with steering findings, outcome proof, and decision queue. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => executiveSteeringRoom(readItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_decision_knowledge_graph",
    description: "Build a decision knowledge graph linking Work Items, evidence, comments, attachments, risks, tests, decisions, and benefits. Does not write.",
    inputSchema: { type: "object", properties: { workItems: { type: "array" }, evidence: { type: "array" }, options: { type: "object" } }, required: ["workItems"] },
    handler: (args) => decisionKnowledgeGraph(readItems(args), recordArrayArg(args.evidence || [], "evidence"), objectArg(args.options))
  },
  {
    name: "azure_boards_product_ai_readiness_prompt_governance",
    description: "Validate AI readiness, prompt governance, data classes, model routing, policies, and LLM mode before board automation rollout. Does not write.",
    inputSchema: { type: "object", properties: { config: { type: "object" }, prompts: { type: "array" }, cases: { type: "array" } } },
    handler: (args) => aiReadinessPromptGovernance(objectArg(args.config), recordArrayArg(args.prompts || [], "prompts"), recordArrayArg(args.cases || [], "cases"))
  },
  {
    name: "azure_boards_store_save",
    description: "Save a JSON artifact to the user-local Azure Boards store.",
    inputSchema: {
      type: "object",
      properties: { kind: { type: "string" }, name: { type: "string" }, data: { type: "object" } },
      required: ["kind", "name", "data"]
    },
    annotations: localWriteAnnotations,
    handler: (args) => saveNamedArtifact(requiredString(args.kind, "kind"), requiredString(args.name, "name"), args.data)
  },
  {
    name: "azure_boards_store_load",
    description: "Load a JSON artifact from the user-local Azure Boards store.",
    inputSchema: {
      type: "object",
      properties: { kind: { type: "string" }, name: { type: "string" } },
      required: ["kind", "name"]
    },
    handler: (args) => loadNamedArtifact(requiredString(args.kind, "kind"), requiredString(args.name, "name"))
  },
  {
    name: "azure_boards_store_list",
    description: "List JSON artifacts from the user-local Azure Boards store.",
    inputSchema: {
      type: "object",
      properties: { kind: { type: "string" } },
      required: ["kind"]
    },
    handler: (args) => listNamedArtifacts(requiredString(args.kind, "kind"))
  },
  {
    name: "azure_boards_store_delete",
    description: "Delete a JSON artifact from the user-local Azure Boards store.",
    inputSchema: {
      type: "object",
      properties: { kind: { type: "string" }, name: { type: "string" } },
      required: ["kind", "name"]
    },
    annotations: destructiveLocalWriteAnnotations,
    handler: (args) => deleteNamedArtifact(requiredString(args.kind, "kind"), requiredString(args.name, "name"))
  },
  {
    name: "azure_boards_store_watchdog_snapshot",
    description: "Save a proactive watchdog report snapshot to the user-local Azure Boards store.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, report: { type: "object" } },
      required: ["name", "report"]
    },
    annotations: localWriteAnnotations,
    handler: (args) => createWatchdogSnapshot(requiredString(args.name, "name"), objectArg(args.report) as never)
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

function readRawItems(args: Record<string, unknown>): Record<string, unknown>[] {
  const raw = args.workItems;
  if (!Array.isArray(raw)) {
    throw new Error("workItems must be an array.");
  }
  return raw.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`workItems[${index}] must be an object.`);
    }
    return item as Record<string, unknown>;
  });
}

async function applyBulkClosePlan(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (args.approved !== true || args.confirmPhrase !== "APPLY_BULK_CLOSE") {
    throw new Error("Bulk close writes require approved:true and confirmPhrase APPLY_BULK_CLOSE.");
  }
  const organization = requiredString(args.organization, "organization");
  const project = requiredString(args.project, "project");
  const preview = objectArg(args.preview) as unknown as BulkClosePreview;
  if (preview.writePerformed !== false || preview.title !== "Bulk Close Preview" || preview.approvalRequired !== true) {
    throw new Error("preview must be a Bulk Close Preview generated by azure_boards_ai_bulk_close_preview.");
  }
  const targets = flattenBulkCloseTargets(Array.isArray(preview.targets) ? preview.targets : []);
  const results: Array<Record<string, unknown>> = [];
  for (const target of targets) {
    try {
      await azure.addComment({ organization, project, id: target.id, text: target.comment || target.rationale });
      const updated = await azure.updateWorkItem({
        organization,
        project,
        id: target.id,
        patch: Array.isArray(target.patchPreview) && target.patchPreview.length
          ? target.patchPreview
          : [{ op: "replace", path: "/fields/System.State", value: target.targetState || "Closed" }]
      });
      results.push({
        id: target.id,
        title: target.title,
        type: target.type,
        success: true,
        targetState: target.targetState,
        actualState: (updated.fields || {})["System.State"],
        patch: target.patchPreview
      });
    } catch (error) {
      results.push({
        id: target.id,
        title: target.title,
        type: target.type,
        success: false,
        error: safeErrorMessage(error),
        patch: target.patchPreview
      });
    }
  }
  const succeeded = results.filter((result) => result.success === true).length;
  const failed = results.length - succeeded;
  return {
    title: "Bulk Close Apply Results",
    generatedAt: new Date().toISOString(),
    writePerformed: true,
    summary: `${succeeded} item(s) updated, ${failed} failed.`,
    metrics: { requestedTargets: targets.length, succeeded, failed },
    results
  };
}

function flattenBulkCloseTargets(targets: BulkCloseTarget[]): BulkCloseTarget[] {
  const flattened: BulkCloseTarget[] = [];
  const seen = new Set<number>();
  for (const target of targets) {
    for (const child of target.childImpact || []) {
      if (!seen.has(child.id)) {
        flattened.push(child);
        seen.add(child.id);
      }
    }
    if (!seen.has(target.id)) {
      flattened.push(target);
      seen.add(target.id);
    }
  }
  return flattened;
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

export async function handle(request: Record<string, unknown>): Promise<Record<string, unknown> | null> {
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
          tools: tools.map(toolDescriptor)
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
          structuredContent: result,
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
        message: safeErrorMessage(error)
      }
    };
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
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
}

async function dispatch(line: string): Promise<void> {
  const request = JSON.parse(line) as Record<string, unknown>;
  const response = await handle(request);
  if (response) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
