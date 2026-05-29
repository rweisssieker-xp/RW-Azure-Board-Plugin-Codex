import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
const ARTIFACT_EXTENSION = ".json";
const WATCHDOG_KIND = "watchdog-snapshot";
export function saveNamedArtifact(kind, name, data) {
    const artifactPath = resolveArtifactPath(kind, name);
    const savedAt = new Date().toISOString();
    const envelope = {
        kind,
        name,
        savedAt,
        data
    };
    mkdirSync(path.dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, `${stableStringify(assertJsonValue(envelope))}\n`, "utf8");
    return { kind, name, data, savedAt };
}
export function loadNamedArtifact(kind, name) {
    const artifactPath = resolveArtifactPath(kind, name);
    if (!existsSync(artifactPath)) {
        return null;
    }
    const parsed = JSON.parse(readFileSync(artifactPath, "utf8"));
    return {
        kind: parsed.kind,
        name: parsed.name,
        data: parsed.data,
        savedAt: parsed.savedAt
    };
}
export function listNamedArtifacts(kind) {
    const kindDirectory = resolveKindDirectory(kind);
    if (!existsSync(kindDirectory)) {
        return [];
    }
    return readdirSync(kindDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(ARTIFACT_EXTENSION))
        .map((entry) => loadListItem(path.join(kindDirectory, entry.name)))
        .filter((entry) => entry !== null && entry.kind === kind)
        .sort((left, right) => left.name.localeCompare(right.name) || left.savedAt.localeCompare(right.savedAt));
}
export function deleteNamedArtifact(kind, name) {
    const artifactPath = resolveArtifactPath(kind, name);
    if (!existsSync(artifactPath)) {
        return false;
    }
    rmSync(artifactPath, { force: true });
    return true;
}
export function createWatchdogSnapshot(name, report) {
    const capturedAt = new Date().toISOString();
    return saveNamedArtifact(WATCHDOG_KIND, name, {
        name,
        report,
        capturedAt
    });
}
function resolveArtifactPath(kind, name) {
    return path.join(resolveKindDirectory(kind), `${sanitizeSegment(name)}${ARTIFACT_EXTENSION}`);
}
function resolveKindDirectory(kind) {
    const storeRoot = getStoreRoot();
    const directory = path.resolve(storeRoot, sanitizeSegment(kind));
    if (!isPathInside(directory, storeRoot)) {
        throw new Error("Resolved artifact directory escapes the Azure Boards local store.");
    }
    return directory;
}
function getStoreRoot() {
    const configuredStoreDir = cleanEnv(process.env.AZURE_BOARDS_STORE_DIR);
    if (configuredStoreDir) {
        return path.resolve(configuredStoreDir);
    }
    const localAppData = cleanEnv(process.env.LOCALAPPDATA);
    if (localAppData) {
        return path.resolve(localAppData, "CodexAzureBoards", "store");
    }
    return path.resolve(homedir(), ".local", "share", "CodexAzureBoards", "store");
}
function sanitizeSegment(value) {
    const normalized = value.normalize("NFKD").trim();
    if (!normalized) {
        throw new Error("Artifact kind and name must be non-empty strings.");
    }
    const slug = normalized
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^[._-]+|[._-]+$/g, "")
        .slice(0, 80);
    const safeSlug = slug || "artifact";
    const hash = createHash("sha256").update(value).digest("hex").slice(0, 12);
    return `${safeSlug}-${hash}`;
}
function cleanEnv(value) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
}
function isPathInside(candidate, parent) {
    const relativePath = path.relative(path.resolve(parent), path.resolve(candidate));
    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
function loadListItem(filePath) {
    try {
        const parsed = JSON.parse(readFileSync(filePath, "utf8"));
        if (typeof parsed.kind !== "string" || typeof parsed.name !== "string" || typeof parsed.savedAt !== "string") {
            return null;
        }
        return {
            kind: parsed.kind,
            name: parsed.name,
            savedAt: parsed.savedAt
        };
    }
    catch {
        return null;
    }
}
function stableStringify(value) {
    return JSON.stringify(sortJsonValue(value), null, 2);
}
function sortJsonValue(value) {
    if (Array.isArray(value)) {
        return value.map(sortJsonValue);
    }
    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((sorted, key) => {
            sorted[key] = sortJsonValue(value[key]);
            return sorted;
        }, {});
    }
    return value;
}
function assertJsonValue(value, seen = new WeakSet()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error("Artifact data must contain only finite JSON numbers.");
        }
        return value;
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) {
            throw new Error("Artifact data must not contain circular references.");
        }
        seen.add(value);
        const jsonArray = value.map((item) => assertJsonValue(item, seen));
        seen.delete(value);
        return jsonArray;
    }
    if (value && typeof value === "object") {
        if (seen.has(value)) {
            throw new Error("Artifact data must not contain circular references.");
        }
        seen.add(value);
        const jsonObject = Object.entries(value).reduce((json, [key, item]) => {
            json[key] = assertJsonValue(item, seen);
            return json;
        }, {});
        seen.delete(value);
        return jsonObject;
    }
    throw new Error("Artifact data must be JSON-serializable.");
}
