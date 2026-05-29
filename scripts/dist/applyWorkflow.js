export function planApprovedActions(actionPlanReport, selection) {
    const actions = Array.isArray(actionPlanReport.actions) ? actionPlanReport.actions : [];
    const approvalIndex = buildApprovalIndex(selection);
    const skipped = [];
    const batches = [];
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
export function summarizeApplyResults(results) {
    const safeResults = Array.isArray(results) ? results : [];
    const skipped = safeResults.filter((result) => result.skipped === true || result.status === "skipped").length;
    const failed = safeResults.filter((result) => result.success === false || result.status === "failed" || Boolean(result.error)).length;
    const succeeded = safeResults.filter((result) => {
        if (result.skipped === true || result.status === "skipped")
            return false;
        if (result.success === false || result.status === "failed" || Boolean(result.error))
            return false;
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
function buildApprovalIndex(selection) {
    const byId = new Map();
    const byRank = new Map();
    const selectedIds = new Set();
    const selectedRanks = new Set();
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
        }
        else {
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
function indexApproval(entry, byId, byRank, selectedIds, selectedRanks) {
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
function approvalFor(action, index, selection) {
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
function skip(action, reason) {
    return {
        id: action.id,
        priorityRank: action.priorityRank,
        title: action.title,
        reason
    };
}
function numbers(values) {
    return (values || []).filter((value) => Number.isFinite(value));
}
function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function clonePatch(patch) {
    return patch.map((operation) => ({ ...operation }));
}
