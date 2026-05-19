import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

import type { Report } from "./types.js";

export interface NamedArtifact<T = unknown> {
  kind: string;
  name: string;
  data: T;
  savedAt: string;
}

export interface NamedArtifactListItem {
  kind: string;
  name: string;
  savedAt: string;
}

export interface WatchdogSnapshot {
  name: string;
  report: Report;
  capturedAt: string;
}

interface StoredEnvelope<T = unknown> {
  kind: string;
  name: string;
  savedAt: string;
  data: T;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const ARTIFACT_EXTENSION = ".json";
const WATCHDOG_KIND = "watchdog-snapshot";

export function saveNamedArtifact<T>(kind: string, name: string, data: T): NamedArtifact<T> {
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

export function loadNamedArtifact<T = unknown>(kind: string, name: string): NamedArtifact<T> | null {
  const artifactPath = resolveArtifactPath(kind, name);
  if (!existsSync(artifactPath)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(artifactPath, "utf8")) as StoredEnvelope<T>;
  return {
    kind: parsed.kind,
    name: parsed.name,
    data: parsed.data,
    savedAt: parsed.savedAt
  };
}

export function listNamedArtifacts(kind: string): NamedArtifactListItem[] {
  const kindDirectory = resolveKindDirectory(kind);
  if (!existsSync(kindDirectory)) {
    return [];
  }

  return readdirSync(kindDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ARTIFACT_EXTENSION))
    .map((entry) => loadListItem(path.join(kindDirectory, entry.name)))
    .filter((entry): entry is NamedArtifactListItem => entry !== null && entry.kind === kind)
    .sort((left, right) => left.name.localeCompare(right.name) || left.savedAt.localeCompare(right.savedAt));
}

export function deleteNamedArtifact(kind: string, name: string): boolean {
  const artifactPath = resolveArtifactPath(kind, name);
  if (!existsSync(artifactPath)) {
    return false;
  }

  rmSync(artifactPath, { force: true });
  return true;
}

export function createWatchdogSnapshot(name: string, report: Report): NamedArtifact<WatchdogSnapshot> {
  const capturedAt = new Date().toISOString();
  return saveNamedArtifact(WATCHDOG_KIND, name, {
    name,
    report,
    capturedAt
  });
}

function resolveArtifactPath(kind: string, name: string): string {
  return path.join(resolveKindDirectory(kind), `${sanitizeSegment(name)}${ARTIFACT_EXTENSION}`);
}

function resolveKindDirectory(kind: string): string {
  const storeRoot = getStoreRoot();
  const directory = path.resolve(storeRoot, sanitizeSegment(kind));

  if (!isPathInside(directory, storeRoot)) {
    throw new Error("Resolved artifact directory escapes the Azure Boards local store.");
  }

  return directory;
}

function getStoreRoot(): string {
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

function sanitizeSegment(value: string): string {
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

function cleanEnv(value: string | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function isPathInside(candidate: string, parent: string): boolean {
  const relativePath = path.relative(path.resolve(parent), path.resolve(candidate));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function loadListItem(filePath: string): NamedArtifactListItem | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as StoredEnvelope;
    if (typeof parsed.kind !== "string" || typeof parsed.name !== "string" || typeof parsed.savedAt !== "string") {
      return null;
    }

    return {
      kind: parsed.kind,
      name: parsed.name,
      savedAt: parsed.savedAt
    };
  } catch {
    return null;
  }
}

function stableStringify(value: JsonValue): string {
  return JSON.stringify(sortJsonValue(value), null, 2);
}

function sortJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((sorted, key) => {
        sorted[key] = sortJsonValue(value[key]);
        return sorted;
      }, {});
  }

  return value;
}

function assertJsonValue(value: unknown, seen = new WeakSet<object>()): JsonValue {
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
    const jsonObject = Object.entries(value).reduce<Record<string, JsonValue>>((json, [key, item]) => {
      json[key] = assertJsonValue(item, seen);
      return json;
    }, {});
    seen.delete(value);
    return jsonObject;
  }

  throw new Error("Artifact data must be JSON-serializable.");
}
