import type { ActionPlanItem, ActionPlanReport } from "./operationalAnalytics.js";

export interface ApplyActionApproval {
  id?: number;
  actionId?: number;
  rank?: number;
  priorityRank?: number;
  approved?: boolean;
}

export interface ApplySelection {
  approved?: boolean;
  ids?: number[];
  actionIds?: number[];
  ranks?: number[];
  priorityRanks?: number[];
  actions?: Array<number | ApplyActionApproval>;
  approvals?: ApplyActionApproval[];
}

export interface PlannedPatchBatch {
  workItemId: number;
  actionId: number;
  priorityRank: number;
  title: string;
  actionType: ActionPlanItem["actionType"];
  action: string;
  rationale: string;
  patch: Array<Record<string, unknown>>;
  writePerformed: false;
}

export interface SkippedApplyAction {
  id?: number;
  priorityRank?: number;
  title?: string;
  reason: string;
}

export interface PlannedApplyWorkflow {
  title: "Approved Apply Workflow";
  generatedAt: string;
  writePerformed: false;
  summary: string;
  batches: PlannedPatchBatch[];
  skipped: SkippedApplyAction[];
  metrics: {
    totalActions: number;
    selectedActions: number;
    plannedBatches: number;
    skippedActions: number;
    patchOperations: number;
  };
}

export interface ApplyResult {
  workItemId?: number;
  actionId?: number;
  priorityRank?: number;
  status?: string;
  success?: boolean;
  skipped?: boolean;
  error?: unknown;
  reason?: string;
  patch?: unknown[];
}

export interface ApplyResultsSummary {
  title: "Apply Results Summary";
  generatedAt: string;
  writePerformed: false;
  summary: string;
  metrics: {
    totalResults: number;
    succeeded: number;
    failed: number;
    skipped: number;
    patchOperations: number;
  };
  results: ApplyResult[];
}

type ActionWithApproval = ActionPlanItem & { approved?: boolean };

export function planApprovedActions(actionPlanReport: ActionPlanReport, selection?: ApplySelection): PlannedApplyWorkflow {
  const actions = Array.isArray(actionPlanReport.actions) ? actionPlanReport.actions : [];
  const approvalIndex = buildApprovalIndex(selection);
  const skipped: SkippedApplyAction[] = [];
  const batches: PlannedPatchBatch[] = [];

  for (const action of actions) {
    const approval = approvalFor(action, approvalIndex, selection);
    const selected = approval.selected;

    if (!selected) {
      skipped.push(skip(action, "not selected"));
      continue;
    }

    if (approval.approved !== true) {
      skipped.push(skip(action, "selected action is missing explicit approved:true"));
      continue;
    }

    if (!Array.isArray(action.patchPreview) || action.patchPreview.length === 0) {
      skipped.push(skip(action, "approved action has no patch preview"));
      continue;
    }

    batches.push({
      workItemId: action.id,
      actionId: action.id,
      priorityRank: action.priorityRank,
      title: action.title,
      actionType: action.actionType,
      action: action.action,
      rationale: action.rationale,
      patch: clonePatch(action.patchPreview),
      writePerformed: false
    });
  }

  const selectedActions = actions.length - skipped.filter((item) => item.reason === "not selected").length;
  const patchOperations = batches.reduce((sum, batch) => sum + batch.patch.length, 0);

  return {
    title: "Approved Apply Workflow",
    generatedAt: new Date().toISOString(),
    writePerformed: false,
    summary: `${batches.length} approved patch batches planned; ${skipped.length} actions skipped. No Azure DevOps writes were performed.`,
    batches,
    skipped,
    metrics: {
      totalActions: actions.length,
      selectedActions,
      plannedBatches: batches.length,
      skippedActions: skipped.length,
      patchOperations
    }
  };
}

export function summarizeApplyResults(results: ApplyResult[]): ApplyResultsSummary {
  const safeResults = Array.isArray(results) ? results : [];
  const skipped = safeResults.filter((result) => result.skipped === true || result.status === "skipped").length;
  const failed = safeResults.filter((result) => result.success === false || result.status === "failed" || Boolean(result.error)).length;
  const succeeded = safeResults.filter((result) => {
    if (result.skipped === true || result.status === "skipped") return false;
    if (result.success === false || result.status === "failed" || Boolean(result.error)) return false;
    return result.success === true || result.status === "success" || result.status === "succeeded" || result.status === "planned";
  }).length;
  const patchOperations = safeResults.reduce((sum, result) => sum + (Array.isArray(result.patch) ? result.patch.length : 0), 0);

  return {
    title: "Apply Results Summary",
    generatedAt: new Date().toISOString(),
    writePerformed: false,
    summary: `${succeeded} succeeded, ${failed} failed, and ${skipped} skipped across ${safeResults.length} apply results.`,
    metrics: {
      totalResults: safeResults.length,
      succeeded,
      failed,
      skipped,
      patchOperations
    },
    results: safeResults
  };
}

function buildApprovalIndex(selection: ApplySelection | undefined): {
  byId: Map<number, boolean>;
  byRank: Map<number, boolean>;
  selectedIds: Set<number>;
  selectedRanks: Set<number>;
  globalApproved: boolean | undefined;
} {
  const byId = new Map<number, boolean>();
  const byRank = new Map<number, boolean>();
  const selectedIds = new Set<number>();
  const selectedRanks = new Set<number>();

  for (const id of [...numbers(selection?.ids), ...numbers(selection?.actionIds)]) {
    selectedIds.add(id);
  }
  for (const rank of [...numbers(selection?.ranks), ...numbers(selection?.priorityRanks)]) {
    selectedRanks.add(rank);
  }

  for (const entry of selection?.actions || []) {
    if (typeof entry === "number") {
      if (Number.isFinite(entry)) {
        selectedIds.add(entry);
      }
    } else {
      indexApproval(entry, byId, byRank, selectedIds, selectedRanks);
    }
  }

  for (const entry of selection?.approvals || []) {
    indexApproval(entry, byId, byRank, selectedIds, selectedRanks);
  }

  return {
    byId,
    byRank,
    selectedIds,
    selectedRanks,
    globalApproved: selection?.approved
  };
}

function indexApproval(
  entry: ApplyActionApproval,
  byId: Map<number, boolean>,
  byRank: Map<number, boolean>,
  selectedIds: Set<number>,
  selectedRanks: Set<number>
): void {
  const id = finiteNumber(entry.id) ?? finiteNumber(entry.actionId);
  const rank = finiteNumber(entry.rank) ?? finiteNumber(entry.priorityRank);

  if (id !== undefined) {
    selectedIds.add(id);
    byId.set(id, entry.approved === true);
  }
  if (rank !== undefined) {
    selectedRanks.add(rank);
    byRank.set(rank, entry.approved === true);
  }
}

function approvalFor(
  action: ActionWithApproval,
  index: ReturnType<typeof buildApprovalIndex>,
  selection: ApplySelection | undefined
): { selected: boolean; approved: boolean | undefined } {
  const selectedById = index.selectedIds.has(action.id);
  const selectedByRank = index.selectedRanks.has(action.priorityRank);
  const hasExplicitSelection = index.selectedIds.size > 0 || index.selectedRanks.size > 0;
  const selected = hasExplicitSelection ? selectedById || selectedByRank : action.approved === true;

  if (!selected) {
    return { selected: false, approved: undefined };
  }

  if (index.byId.has(action.id)) {
    return { selected: true, approved: index.byId.get(action.id) };
  }
  if (index.byRank.has(action.priorityRank)) {
    return { selected: true, approved: index.byRank.get(action.priorityRank) };
  }
  if (selection && (selectedById || selectedByRank)) {
    return { selected: true, approved: selection.approved === true };
  }
  return { selected: true, approved: action.approved === true };
}

function skip(action: ActionPlanItem, reason: string): SkippedApplyAction {
  return {
    id: action.id,
    priorityRank: action.priorityRank,
    title: action.title,
    reason
  };
}

function numbers(values: number[] | undefined): number[] {
  return (values || []).filter((value) => Number.isFinite(value));
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clonePatch(patch: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return patch.map((operation) => ({ ...operation }));
}
