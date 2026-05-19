import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { redactSecrets } from "./security.js";

export const EXPECTED_FUTURE_MCP_TOOLS = [
  "azure_boards_package_health",
  "azure_boards_auth_environment_check"
] as const;

export interface PackageHealthResult {
  ok: boolean;
  root: string;
  packageName: string | null;
  version: string | null;
  moduleType: string | null;
  scripts: {
    build: boolean;
    test: boolean;
    start: boolean;
  };
  files: {
    packageJson: boolean;
    packageLock: boolean;
    tsconfig: boolean;
    src: boolean;
    dist: boolean;
  };
  expectedFutureMcpTools: readonly string[];
  issues: string[];
}

export interface AuthEnvironmentCheckResult {
  ok: boolean;
  configured: boolean;
  authModes: string[];
  variables: Record<string, { configured: boolean }>;
  issues: string[];
}

type EnvLike = Record<string, string | undefined>;

export function packageHealthCheck(root = process.cwd()): PackageHealthResult {
  const resolvedRoot = resolve(root);
  const packageJsonPath = join(resolvedRoot, "package.json");
  const tsconfigPath = join(resolvedRoot, "tsconfig.json");
  const packageJson = readJson(packageJsonPath);
  const scripts = isRecord(packageJson?.scripts) ? packageJson.scripts : {};
  const files = {
    packageJson: existsSync(packageJsonPath),
    packageLock: existsSync(join(resolvedRoot, "package-lock.json")),
    tsconfig: existsSync(tsconfigPath),
    src: existsSync(join(resolvedRoot, "src")),
    dist: existsSync(join(resolvedRoot, "dist"))
  };
  const result: PackageHealthResult = {
    ok: true,
    root: resolvedRoot,
    packageName: typeof packageJson?.name === "string" ? packageJson.name : null,
    version: typeof packageJson?.version === "string" ? packageJson.version : null,
    moduleType: typeof packageJson?.type === "string" ? packageJson.type : null,
    scripts: {
      build: typeof scripts.build === "string" && scripts.build.trim().length > 0,
      test: typeof scripts.test === "string" && scripts.test.trim().length > 0,
      start: typeof scripts.start === "string" && scripts.start.trim().length > 0
    },
    files,
    expectedFutureMcpTools: EXPECTED_FUTURE_MCP_TOOLS,
    issues: []
  };

  if (!files.packageJson) result.issues.push("package.json is missing.");
  if (!files.tsconfig) result.issues.push("tsconfig.json is missing.");
  if (!files.src) result.issues.push("src directory is missing.");
  if (!result.scripts.build) result.issues.push("package build script is missing.");
  if (!result.scripts.test) result.issues.push("package test script is missing.");
  if (!result.packageName) result.issues.push("package name is missing.");
  if (result.moduleType !== "module") result.issues.push("package type should be module.");

  return redactSecrets({ ...result, ok: result.issues.length === 0 });
}

export function authEnvironmentCheck(env: EnvLike = process.env): AuthEnvironmentCheckResult {
  const variables = {
    AZURE_BOARDS_PAT: flag(env.AZURE_BOARDS_PAT),
    AZURE_DEVOPS_PAT: flag(env.AZURE_DEVOPS_PAT),
    AZURE_BOARDS_BEARER_TOKEN: flag(env.AZURE_BOARDS_BEARER_TOKEN),
    AZURE_BOARDS_CLIENT_ID: flag(env.AZURE_BOARDS_CLIENT_ID),
    AZURE_BOARDS_TENANT_ID: flag(env.AZURE_BOARDS_TENANT_ID),
    AZURE_BOARDS_TOKEN_CACHE: flag(env.AZURE_BOARDS_TOKEN_CACHE),
    AZURE_BOARDS_SCOPES: flag(env.AZURE_BOARDS_SCOPES)
  };
  const authModes: string[] = [];
  if (variables.AZURE_BOARDS_PAT.configured || variables.AZURE_DEVOPS_PAT.configured) authModes.push("pat");
  if (variables.AZURE_BOARDS_BEARER_TOKEN.configured) authModes.push("bearer-token");
  if (variables.AZURE_BOARDS_CLIENT_ID.configured) authModes.push("oauth-device-code");

  const issues: string[] = [];
  if (authModes.length === 0) {
    issues.push("No Azure Boards auth mode is configured.");
  }
  if (authModes.includes("oauth-device-code") && !variables.AZURE_BOARDS_TENANT_ID.configured) {
    issues.push("AZURE_BOARDS_TENANT_ID is not set; Microsoft common tenant will be used.");
  }

  return redactSecrets({
    ok: authModes.length > 0,
    configured: authModes.length > 0,
    authModes,
    variables,
    issues
  });
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flag(value: string | undefined): { configured: boolean } {
  return { configured: typeof value === "string" && value.trim().length > 0 };
}
