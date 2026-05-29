const CLOSED_STATES = new Set(["closed", "done", "removed", "resolved", "completed"]);
const FIXED_GENERATED_AT = "1970-01-01T00:00:00.000Z";
export function deliverySystemCorrelation(workItems, evidence = {}, options = {}) {
    const items = workItems.map(normalizeWorkItem).filter((item) => Boolean(item));
    const normalizedEvidence = [
        ...normalizePullRequests(evidence.pullRequests),
        ...normalizeBuilds(evidence.builds),
        ...normalizePipelines(evidence.pipelines),
        ...normalizeReleases(evidence.releases)
    ];
    const asOf = referenceDate(items, normalizedEvidence, options.asOfDate);
    const correlations = correlate(items, normalizedEvidence);
    const findings = [
        ...globalHealthFindings(normalizedEvidence),
        ...correlations.flatMap((entry) => itemFindings(entry, asOf, options))
    ]
        .sort(byFindingPriority)
        .slice(0, positiveInteger(options.maxFindings, 30));
    const correlatedItems = correlations.filter((entry) => entry.evidence.length > 0).length;
    const failedEvidence = normalizedEvidence.filter((entry) => entry.health === "failed").length;
    const warningEvidence = normalizedEvidence.filter((entry) => entry.health === "warning").length;
    const openItems = items.filter((item) => !isClosed(item)).length;
    return {
        title: "Delivery-System Correlation Analytics",
        generatedAt: asOf.toISOString(),
        summary: `${correlatedItems} of ${items.length} Work Items have delivery-system evidence; ${failedEvidence} failed and ${warningEvidence} warning delivery records were detected.`,
        findings,
        metrics: {
            assessedItems: items.length,
            openItems,
            deliveryEvidenceRecords: normalizedEvidence.length,
            pullRequests: normalizedEvidence.filter((entry) => entry.kind === "pullRequest").length,
            builds: normalizedEvidence.filter((entry) => entry.kind === "build").length,
            pipelines: normalizedEvidence.filter((entry) => entry.kind === "pipeline").length,
            releases: normalizedEvidence.filter((entry) => entry.kind === "release").length,
            correlatedItems,
            uncorrelatedOpenItems: correlations.filter((entry) => !isClosed(entry.item) && entry.evidence.length === 0).length,
            failedEvidence,
            warningEvidence
        },
        nextActions: [
            "Review failed build and release findings before accepting delivery status.",
            "Add Work Item ids to pull request titles, commit messages, and source branches where correlation is missing.",
            "Use uncorrelated open items to identify work that lacks delivery evidence."
        ]
    };
}
function normalizeWorkItem(item) {
    const id = numberValue(item.id);
    if (id === undefined)
        return undefined;
    const summary = item;
    const fields = isRecord(item.fields) ? item.fields : {};
    return {
        id,
        title: stringValue(summary.title) || stringField(fields, "System.Title") || "(untitled)",
        type: stringValue(summary.type) || stringField(fields, "System.WorkItemType") || "Work Item",
        state: stringValue(summary.state) || stringField(fields, "System.State") || "Unknown",
        description: [
            stringField(fields, "System.Description"),
            stringField(fields, "Microsoft.VSTS.Common.AcceptanceCriteria"),
            (summary.tags || []).join(" ")
        ].filter(Boolean).join(" "),
        changedDate: stringValue(summary.changedDate) || stringField(fields, "System.ChangedDate") || stringField(fields, "System.CreatedDate")
    };
}
function normalizePullRequests(input) {
    return arrayFrom(input).map((entry) => {
        const title = firstString(entry, ["title", "name"]) || `Pull Request ${firstString(entry, ["pullRequestId", "id"]) || ""}`.trim();
        const status = firstString(entry, ["status"]) || "unknown";
        const result = firstString(entry, ["mergeStatus", "completionOptions.mergeStrategy"]) || status;
        const source = firstString(entry, ["sourceRefName", "sourceBranch", "fromRefName"]);
        const target = firstString(entry, ["targetRefName", "targetBranch", "toRefName"]);
        const commitMessages = collectNestedStrings(entry, ["comment", "message", "commentTruncated"]);
        const text = joinText([
            title,
            firstString(entry, ["description"]),
            status,
            result,
            source,
            target,
            ...commitMessages
        ]);
        return {
            kind: "pullRequest",
            title,
            status,
            result,
            health: healthForPullRequest(status, result),
            date: firstString(entry, ["creationDate", "closedDate", "lastMergeCommit.author.date"]),
            url: firstString(entry, ["url", "remoteUrl", "_links.web.href"]),
            text
        };
    });
}
function normalizeBuilds(input) {
    return arrayFrom(input).map((entry) => {
        const title = firstString(entry, ["buildNumber", "definition.name", "name"]) || `Build ${firstString(entry, ["id"]) || ""}`.trim();
        const status = firstString(entry, ["status"]) || "unknown";
        const result = firstString(entry, ["result"]) || status;
        const text = joinText([
            title,
            status,
            result,
            firstString(entry, ["sourceBranch", "sourceVersion", "requestedFor.displayName", "definition.name"]),
            firstString(entry, ["triggerInfo.ci.message", "triggerInfo.pr.title", "triggerInfo.pr.sourceBranch"]),
            ...collectNestedStrings(entry, ["message", "comment", "sourceBranch"])
        ]);
        return {
            kind: "build",
            title,
            status,
            result,
            health: healthForRun(status, result),
            date: firstString(entry, ["finishTime", "startTime", "queueTime"]),
            url: firstString(entry, ["url", "_links.web.href"]),
            text
        };
    });
}
function normalizePipelines(input) {
    return arrayFrom(input).map((entry) => {
        const title = firstString(entry, ["name", "folder"]) || `Pipeline ${firstString(entry, ["id"]) || ""}`.trim();
        const status = firstString(entry, ["state", "status"]) || "unknown";
        const result = firstString(entry, ["result"]) || status;
        return {
            kind: "pipeline",
            title,
            status,
            result,
            health: healthForRun(status, result),
            date: firstString(entry, ["createdDate", "modifiedDate"]),
            url: firstString(entry, ["url", "_links.web.href"]),
            text: joinText([title, status, result, firstString(entry, ["configuration.path", "folder"])])
        };
    });
}
function normalizeReleases(input) {
    return arrayFrom(input).map((entry) => {
        const title = firstString(entry, ["name", "releaseDefinition.name"]) || `Release ${firstString(entry, ["id"]) || ""}`.trim();
        const status = firstString(entry, ["status", "reason"]) || "unknown";
        const environmentStatuses = collectNestedStrings(entry, ["status", "deploymentStatus", "operationStatus"]);
        const result = environmentStatuses.find((value) => failedWord(value)) || environmentStatuses.find((value) => warningWord(value)) || status;
        const artifactText = collectNestedStrings(entry, ["sourceBranch", "sourceVersion", "alias", "definitionReference"]);
        return {
            kind: "release",
            title,
            status,
            result,
            health: healthForRun(status, result),
            date: firstString(entry, ["createdOn", "modifiedOn"]),
            url: firstString(entry, ["url", "_links.web.href"]),
            text: joinText([title, status, result, ...artifactText])
        };
    });
}
function correlate(items, evidence) {
    const knownIds = new Set(items.map((item) => item.id));
    const byId = new Map();
    for (const entry of evidence) {
        for (const id of mentionedWorkItemIds(entry.text, knownIds)) {
            const existing = byId.get(id) || [];
            existing.push(entry);
            byId.set(id, existing);
        }
    }
    return items.map((item) => {
        const itemEvidence = byId.get(item.id) || [];
        return {
            item,
            evidence: itemEvidence,
            pullRequests: itemEvidence.filter((entry) => entry.kind === "pullRequest"),
            builds: itemEvidence.filter((entry) => entry.kind === "build"),
            releases: itemEvidence.filter((entry) => entry.kind === "release"),
            pipelines: itemEvidence.filter((entry) => entry.kind === "pipeline"),
            failed: itemEvidence.filter((entry) => entry.health === "failed"),
            warnings: itemEvidence.filter((entry) => entry.health === "warning")
        };
    });
}
function globalHealthFindings(evidence) {
    const findings = [];
    const builds = evidence.filter((entry) => entry.kind === "build");
    const releases = evidence.filter((entry) => entry.kind === "release");
    const failedBuilds = builds.filter((entry) => entry.health === "failed");
    const failedReleases = releases.filter((entry) => entry.health === "failed");
    const warningBuilds = builds.filter((entry) => entry.health === "warning");
    const warningReleases = releases.filter((entry) => entry.health === "warning");
    if (builds.length) {
        findings.push({
            title: failedBuilds.length ? "Global build health is degraded" : "Global build health snapshot",
            score: failedBuilds.length ? Math.min(100, 55 + failedBuilds.length * 12 + warningBuilds.length * 5) : Math.max(10, warningBuilds.length * 15),
            severity: failedBuilds.length > 2 ? "critical" : failedBuilds.length ? "high" : warningBuilds.length ? "medium" : "low",
            signals: [`${builds.length} builds assessed`, `${failedBuilds.length} failed builds`, `${warningBuilds.length} warning/in-progress builds`],
            recommendation: failedBuilds.length
                ? "Stabilize failing builds before treating correlated Work Items as delivery-ready."
                : "Keep build identifiers and source branches aligned with Work Item ids for traceability."
        });
    }
    if (releases.length) {
        findings.push({
            title: failedReleases.length ? "Global release health is degraded" : "Global release health snapshot",
            score: failedReleases.length ? Math.min(100, 60 + failedReleases.length * 15 + warningReleases.length * 5) : Math.max(10, warningReleases.length * 15),
            severity: failedReleases.length > 1 ? "critical" : failedReleases.length ? "high" : warningReleases.length ? "medium" : "low",
            signals: [`${releases.length} releases assessed`, `${failedReleases.length} failed releases`, `${warningReleases.length} warning/in-progress releases`],
            recommendation: failedReleases.length
                ? "Review failed release environments and block promotion until the failing deployment evidence is explained."
                : "Maintain release artifact metadata so Work Items can be traced through promotion."
        });
    }
    return findings;
}
function itemFindings(entry, asOf, options) {
    const findings = [];
    const staleDays = positiveInteger(options.staleDays, 14);
    const item = entry.item;
    const open = !isClosed(item);
    const stale = open && daysBetween(item.changedDate, asOf) > staleDays;
    if (entry.failed.length) {
        findings.push({
            id: item.id,
            title: `#${item.id} ${item.title}: correlated delivery failure`,
            score: Math.min(100, 70 + entry.failed.length * 10),
            severity: entry.failed.length > 2 ? "critical" : "high",
            signals: [
                `${entry.failed.length} failed delivery records mention #${item.id}`,
                ...entry.failed.slice(0, 4).map((record) => `${label(record.kind)} "${record.title}" result ${record.result}`)
            ],
            recommendation: "Inspect the correlated build/release evidence before closing or accepting this Work Item."
        });
    }
    if (open && entry.evidence.length === 0) {
        findings.push({
            id: item.id,
            title: `#${item.id} ${item.title}: no delivery-system evidence found`,
            score: stale ? 65 : 45,
            severity: stale ? "high" : "medium",
            signals: [
                `no pull request, build, pipeline, or release text mentioned #${item.id}`,
                stale ? `open item has not changed for ${daysBetween(item.changedDate, asOf)} days` : "open item is not yet correlated to delivery evidence"
            ],
            recommendation: "Add the Work Item id to the PR title, commit message, source branch, or release artifact metadata."
        });
    }
    if (entry.pullRequests.length && !entry.builds.length && open) {
        findings.push({
            id: item.id,
            title: `#${item.id} ${item.title}: PR evidence lacks build evidence`,
            score: 55,
            severity: "medium",
            signals: [
                `${entry.pullRequests.length} pull requests mention #${item.id}`,
                "no build records mention the same Work Item id"
            ],
            recommendation: "Confirm CI is running for the PR branch and preserving Work Item ids in build metadata."
        });
    }
    if (options.includeHealthyItems && entry.evidence.length && !entry.failed.length && !entry.warnings.length) {
        findings.push({
            id: item.id,
            title: `#${item.id} ${item.title}: healthy correlated delivery evidence`,
            score: 15,
            severity: "low",
            signals: [
                `${entry.evidence.length} delivery records mention #${item.id}`,
                `${entry.pullRequests.length} PRs, ${entry.builds.length} builds, ${entry.releases.length} releases`
            ],
            recommendation: "Keep the same identifier convention in future PRs, commits, branches, and release artifacts."
        });
    }
    return findings;
}
function mentionedWorkItemIds(text, knownIds) {
    const found = new Set();
    const prefixed = /(?:AB#|#|work\s*item\s*|wi[-_#\s]*)(\d{1,9})/gi;
    for (const match of text.matchAll(prefixed)) {
        const id = numberValue(match[1]);
        if (id !== undefined && knownIds.has(id))
            found.add(id);
    }
    for (const id of knownIds) {
        const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const branchOrToken = new RegExp(`(?:^|[^0-9a-z])${escaped}(?:[^0-9a-z]|$)`, "i");
        if (branchOrToken.test(text))
            found.add(id);
    }
    return [...found];
}
function referenceDate(items, evidence, override) {
    const explicit = dateValue(override);
    if (explicit)
        return explicit;
    const timestamps = [
        ...items.map((item) => dateValue(item.changedDate)?.getTime()),
        ...evidence.map((entry) => dateValue(entry.date)?.getTime())
    ].filter((value) => typeof value === "number" && Number.isFinite(value));
    return timestamps.length ? new Date(Math.max(...timestamps)) : new Date(FIXED_GENERATED_AT);
}
function arrayFrom(input) {
    const value = isRecord(input) && Array.isArray(input.value) ? input.value : input;
    return Array.isArray(value) ? value.filter(isRecord) : [];
}
function firstString(record, paths) {
    for (const path of paths) {
        const value = valueAt(record, path);
        const text = stringValue(value);
        if (text)
            return text;
    }
    return undefined;
}
function collectNestedStrings(input, keys, limit = 20) {
    const found = [];
    const wanted = new Set(keys.map((key) => key.toLowerCase()));
    const visit = (value) => {
        if (found.length >= limit)
            return;
        if (Array.isArray(value)) {
            for (const item of value)
                visit(item);
            return;
        }
        if (!isRecord(value))
            return;
        for (const [key, child] of Object.entries(value)) {
            if (found.length >= limit)
                return;
            const normalizedKey = key.toLowerCase();
            if (wanted.has(normalizedKey) || keys.some((wantedKey) => normalizedKey.endsWith(wantedKey.toLowerCase()))) {
                const text = stringValue(child);
                if (text)
                    found.push(text);
            }
            if (Array.isArray(child) || isRecord(child))
                visit(child);
        }
    };
    visit(input);
    return [...new Set(found)];
}
function valueAt(record, path) {
    return path.split(".").reduce((current, part) => (isRecord(current) ? current[part] : undefined), record);
}
function stringField(fields, name) {
    return stringValue(fields[name]);
}
function stringValue(value) {
    if (typeof value === "string") {
        const trimmed = stripHtml(value).trim();
        return trimmed || undefined;
    }
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    if (isRecord(value)) {
        return stringValue(value.displayName) || stringValue(value.name) || stringValue(value.id);
    }
    return undefined;
}
function numberValue(value) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}
function dateValue(value) {
    const text = stringValue(value);
    if (!text)
        return undefined;
    const timestamp = Date.parse(text);
    return Number.isFinite(timestamp) ? new Date(timestamp) : undefined;
}
function joinText(values) {
    return values.filter(Boolean).join(" ").toLowerCase();
}
function stripHtml(value) {
    return value.replace(/<[^>]+>/g, " ");
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function isClosed(item) {
    return CLOSED_STATES.has(item.state.toLowerCase());
}
function healthForPullRequest(status, result) {
    const text = `${status} ${result}`.toLowerCase();
    if (failedWord(text) || text.includes("conflict") || text.includes("rejected"))
        return "failed";
    if (warningWord(text) || text.includes("active") || text.includes("notset") || text.includes("queued"))
        return "warning";
    if (text.includes("completed") || text.includes("succeeded") || text.includes("approved"))
        return "healthy";
    return "unknown";
}
function healthForRun(status, result) {
    const text = `${status} ${result}`.toLowerCase();
    if (failedWord(text))
        return "failed";
    if (warningWord(text) || text.includes("inprogress") || text.includes("in progress") || text.includes("queued") || text.includes("notstarted"))
        return "warning";
    if (text.includes("succeeded") || text.includes("completed") || text.includes("partiallysuccessful"))
        return "healthy";
    return "unknown";
}
function failedWord(value) {
    const text = value.toLowerCase();
    return text.includes("failed") || text.includes("failure") || text.includes("canceled") || text.includes("cancelled") || text.includes("rejected");
}
function warningWord(value) {
    const text = value.toLowerCase();
    return text.includes("warning") || text.includes("partial") || text.includes("unstable") || text.includes("pending");
}
function daysBetween(value, asOf) {
    const date = dateValue(value);
    if (!date)
        return 0;
    return Math.max(0, Math.floor((asOf.getTime() - date.getTime()) / 86_400_000));
}
function positiveInteger(value, fallback) {
    const parsed = numberValue(value);
    return parsed !== undefined && parsed > 0 ? parsed : fallback;
}
function byFindingPriority(left, right) {
    return (right.score || 0) - (left.score || 0) || (left.id || 0) - (right.id || 0) || left.title.localeCompare(right.title);
}
function label(kind) {
    if (kind === "pullRequest")
        return "PR";
    return kind[0].toUpperCase() + kind.slice(1);
}
