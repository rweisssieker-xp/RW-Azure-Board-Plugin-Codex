import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const scriptsRoot = process.cwd();
const checkScript = path.join(scriptsRoot, "production-readiness-check.mjs");

test("production readiness gate reports only publisher-owned placeholder failures", () => {
  const result = spawnSync(process.execPath, [checkScript, "--json"], {
    cwd: scriptsRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 1, "gate should fail until real publisher metadata replaces placeholders");

  const report = JSON.parse(result.stdout);
  const failedNames = report.checks.filter((check) => !check.pass).map((check) => check.name);
  assert.deepEqual(failedNames, [
    "Manifest support email is publisher-owned",
    "Manifest author URL is publisher-owned",
    "Manifest homepage is publisher-owned",
    "Manifest repository URL is publisher-owned",
    "Manifest website URL is publisher-owned",
    "Manifest privacy policy URL is publisher-owned",
    "Manifest terms URL is publisher-owned"
  ]);

  for (const requiredPass of [
    "Plugin manifest exists",
    "App submission metadata exists",
    "Hosted MCP Dockerfile exists",
    "Production env template exists",
    "Production publisher input template exists",
    "Production readiness guide exists",
    "Hosted MCP deployment guide exists",
    "App listing draft exists",
    "USP and feature completion audit exists",
    "Release handoff checklist exists",
    "Sanitized ERP/Azure Boards demo dataset exists",
    "Decision Pack screenshot exists",
    "Approval workflow screenshot exists",
    "Production publisher input apply script exists",
    "Hosted MCP smoke test script exists",
    "Hosted HTTP MCP source exists",
    "Product operating system source exists",
    "Manifest references decision and approval screenshots",
    "Production env includes Microsoft Entra client id",
    "Production env includes hosted MCP URL",
    "Production env includes persistent store path",
    "Hosted deployment doc covers automated smoke test",
    "Production gate doc covers publisher input apply command",
    "Release handoff covers Publisher Values",
    "Release handoff covers Hosted MCP",
    "Release handoff covers OAuth",
    "Release handoff covers Product Evidence",
    "Release handoff covers Final Gates",
    "createPersistentSnapshot is implemented",
    "createPersistentBaseline is implemented",
    "approvalQueue is implemented",
    "approvalApplyPlan is implemented",
    "approvalResultReview is implemented",
    "auditTrail is implemented",
    "roleCockpitConfig is implemented",
    "adminConsoleConfig is implemented",
    "automatedReminderPlan is implemented",
    "decisionPackExport is implemented",
    "decisionPackImport is implemented",
    "Decision Pack includes Audit Pack section",
    "Reminder plan includes schedule metadata"
  ]) {
    const check = report.checks.find((candidate) => candidate.name === requiredPass);
    assert.equal(check?.pass, true, `${requiredPass} should pass`);
  }
});
