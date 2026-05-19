import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { authEnvironmentCheck, EXPECTED_FUTURE_MCP_TOOLS, packageHealthCheck } from "../dist/packageHealth.js";
import { redactSecrets, safeErrorMessage } from "../dist/security.js";

const scriptsRoot = fileURLToPath(new URL("..", import.meta.url));

test("redactSecrets removes known secret values from nested values and strings", () => {
  const secret = "super-secret-token";
  const redacted = redactSecrets({
    token: secret,
    nested: {
      authorization: `Bearer ${secret}`,
      message: `AZURE_BOARDS_PAT=${secret} url=https://example.test?access_token=${secret}`
    },
    safe: "visible"
  });
  const serialized = JSON.stringify(redacted);

  assert.equal(redacted.safe, "visible");
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.match(serialized, /\[REDACTED\]/);
});

test("safeErrorMessage redacts secrets from Error and non-Error inputs", () => {
  const message = safeErrorMessage(new Error("request failed with Authorization: Basic abc123 and client_secret=hidden"));
  const objectMessage = safeErrorMessage({ refreshToken: "refresh-secret", detail: "token=plain-secret" });

  assert.doesNotMatch(message, /abc123|hidden/);
  assert.doesNotMatch(objectMessage, /refresh-secret|plain-secret/);
  assert.match(`${message} ${objectMessage}`, /\[REDACTED\]/);
});

test("packageHealthCheck returns basic package shape without secret values", () => {
  const health = packageHealthCheck(join(scriptsRoot));
  const serialized = JSON.stringify(health);

  assert.equal(health.ok, true);
  assert.equal(health.packageName, "@rw-local/azure-boards-mcp");
  assert.equal(health.moduleType, "module");
  assert.equal(health.scripts.build, true);
  assert.equal(health.scripts.test, true);
  assert.equal(health.files.packageJson, true);
  assert.equal(health.files.tsconfig, true);
  assert.ok(Array.isArray(health.issues));
  assert.doesNotMatch(serialized, /AZURE_BOARDS_PAT|Bearer\s+[A-Za-z0-9]/);
});

test("authEnvironmentCheck reports auth configuration without returning secret values", () => {
  const secret = "pat-secret-value";
  const result = authEnvironmentCheck({
    AZURE_BOARDS_PAT: secret,
    AZURE_BOARDS_BEARER_TOKEN: "bearer-secret-value",
    AZURE_BOARDS_CLIENT_ID: "public-client-id"
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.ok, true);
  assert.deepEqual(result.authModes, ["pat", "bearer-token", "oauth-device-code"]);
  assert.equal(result.variables.AZURE_BOARDS_PAT.configured, true);
  assert.equal(result.variables.AZURE_BOARDS_BEARER_TOKEN.configured, true);
  assert.doesNotMatch(serialized, /pat-secret-value|bearer-secret-value|public-client-id/);
});

test("policy validation remains available through analytics when present", async (t) => {
  const analytics = await import("../dist/analytics.js");
  if (typeof analytics.workflowConformance !== "function") {
    t.skip("workflowConformance is not available in this build.");
    return;
  }

  const report = analytics.workflowConformance(
    [{ id: 1, title: "Bug", type: "Bug", state: "Active", assignedTo: "", tags: [], createdDate: "2026-01-01T00:00:00.000Z", changedDate: "2026-01-02T00:00:00.000Z" }],
    { requiredTags: ["audit"], allowedTypes: ["User Story"] }
  );

  assert.equal(report.title, "Workflow Conformance Checker");
  assert.ok(report.findings.length >= 1);
  assert.match(JSON.stringify(report.findings), /missing required tag audit|outside allowed policy/);
});

test("hardening helpers expose expected future MCP tool names", () => {
  assert.deepEqual([...EXPECTED_FUTURE_MCP_TOOLS], [
    "azure_boards_package_health",
    "azure_boards_auth_environment_check"
  ]);

  const health = packageHealthCheck(join(scriptsRoot));
  assert.deepEqual([...health.expectedFutureMcpTools], [...EXPECTED_FUTURE_MCP_TOOLS]);
});
