import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const pluginRoot = path.resolve(process.cwd(), "..");
const checks = [];

checkFile(".codex-plugin/plugin.json", "Plugin manifest exists");
checkFile("chatgpt-app-submission.json", "App submission metadata exists");
checkFile("Dockerfile", "Hosted MCP Dockerfile exists");
checkFile(".env.production.example", "Production env template exists");
checkFile("production-publisher-inputs.example.json", "Production publisher input template exists");
checkFile("docs/production-readiness.md", "Production readiness guide exists");
checkFile("docs/hosted-mcp-deployment.md", "Hosted MCP deployment guide exists");
checkFile("docs/app-listing.md", "App listing draft exists");
checkFile("docs/completion-audit.md", "USP and feature completion audit exists");
checkFile("docs/release-handoff-checklist.md", "Release handoff checklist exists");
checkFile("demo/erp-board-demo.json", "Sanitized ERP/Azure Boards demo dataset exists");
checkFile("assets/screenshots/decision-pack.png", "Decision Pack screenshot exists");
checkFile("assets/screenshots/approval-workflow.png", "Approval workflow screenshot exists");
checkFile("scripts/apply-production-publisher-inputs.mjs", "Production publisher input apply script exists");
checkFile("scripts/hosted-mcp-smoke.mjs", "Hosted MCP smoke test script exists");
checkFile("scripts/src/hostedServer.ts", "Hosted HTTP MCP source exists");
checkFile("scripts/src/productOperatingSystem.ts", "Product operating system source exists");

const manifest = readJson(".codex-plugin/plugin.json");
if (manifest) {
  checkValue(!containsPlaceholder(manifest.author?.email), "Manifest support email is publisher-owned");
  checkValue(!containsPlaceholder(manifest.author?.url), "Manifest author URL is publisher-owned");
  checkValue(!containsPlaceholder(manifest.homepage), "Manifest homepage is publisher-owned");
  checkValue(!containsPlaceholder(manifest.repository), "Manifest repository URL is publisher-owned");
  checkValue(!containsPlaceholder(manifest.interface?.websiteURL), "Manifest website URL is publisher-owned");
  checkValue(!containsPlaceholder(manifest.interface?.privacyPolicyURL), "Manifest privacy policy URL is publisher-owned");
  checkValue(!containsPlaceholder(manifest.interface?.termsOfServiceURL), "Manifest terms URL is publisher-owned");
  checkValue(Array.isArray(manifest.interface?.screenshots) && manifest.interface.screenshots.length >= 2, "Manifest references decision and approval screenshots");
}

const submission = readJson("chatgpt-app-submission.json");
if (submission) {
  checkValue(!containsPlaceholder(submission.production?.support_email), "Submission support email is publisher-owned");
  checkValue(!containsPlaceholder(submission.production?.website_url), "Submission website URL is publisher-owned");
  checkValue(!containsPlaceholder(submission.production?.privacy_policy_url), "Submission privacy policy URL is publisher-owned");
  checkValue(!containsPlaceholder(submission.production?.terms_of_service_url), "Submission terms URL is publisher-owned");
  checkValue(!containsPlaceholder(submission.production?.hosted_mcp_url), "Submission hosted MCP URL is production-owned");
  checkValue(!containsPlaceholder(submission.production?.microsoft_entra?.client_id), "Submission Microsoft Entra client id is production-owned");
  const submittedToolNames = new Set(Object.keys(submission.tools ?? {}));
  for (const toolName of [
    "azure_boards_product_outcome_proof_engine",
    "azure_boards_product_decision_memory_learning",
    "azure_boards_product_board_to_value_mapping",
    "azure_boards_product_autonomous_governance_plan",
    "azure_boards_product_compliance_evidence_score",
    "azure_boards_product_scope_creep_radar",
    "azure_boards_product_approval_simulation",
    "azure_boards_product_executive_steering_room",
    "azure_boards_product_decision_knowledge_graph",
    "azure_boards_product_ai_readiness_prompt_governance"
  ]) {
    checkValue(submittedToolNames.has(toolName), `Submission includes ${toolName}`);
  }
}

const envTemplate = readText(".env.production.example");
if (envTemplate) {
  checkValue(envTemplate.includes("AZURE_BOARDS_CLIENT_ID="), "Production env includes Microsoft Entra client id");
  checkValue(envTemplate.includes("AZURE_BOARDS_HOSTED_MCP_URL="), "Production env includes hosted MCP URL");
  checkValue(envTemplate.includes("AZURE_BOARDS_STORE_DIR="), "Production env includes persistent store path");
}

const publisherInputTemplate = readJson("production-publisher-inputs.example.json");
if (publisherInputTemplate) {
  for (const key of [
    "publisherName",
    "supportEmail",
    "authorUrl",
    "homepageUrl",
    "repositoryUrl",
    "websiteUrl",
    "privacyPolicyUrl",
    "termsOfServiceUrl",
    "hostedMcpUrl",
    "entraClientId",
    "entraTenantId"
  ]) {
    checkValue(Object.hasOwn(publisherInputTemplate, key), `Production publisher input template includes ${key}`);
  }
}

const hostedDoc = readText("docs/hosted-mcp-deployment.md");
if (hostedDoc) {
  checkValue(hostedDoc.includes("/healthz") && hostedDoc.includes("/mcp"), "Hosted deployment doc covers health and MCP endpoints");
  checkValue(hostedDoc.includes("Microsoft Entra OAuth"), "Hosted deployment doc covers production OAuth");
  checkValue(hostedDoc.includes("smoke:hosted"), "Hosted deployment doc covers automated smoke test");
}

const productionGateDoc = readText("docs/production-gate.md");
if (productionGateDoc) {
  checkValue(productionGateDoc.includes("apply:production-inputs"), "Production gate doc covers publisher input apply command");
}

const releaseHandoffDoc = readText("docs/release-handoff-checklist.md");
if (releaseHandoffDoc) {
  for (const requiredSection of ["Publisher Values", "Hosted MCP", "OAuth", "Product Evidence", "Final Gates"]) {
    checkValue(releaseHandoffDoc.includes(requiredSection), `Release handoff covers ${requiredSection}`);
  }
}

const productSource = readText("scripts/src/productOperatingSystem.ts");
if (productSource) {
  for (const symbol of [
    "createPersistentSnapshot",
    "createPersistentBaseline",
    "approvalQueue",
    "approvalApplyPlan",
    "approvalResultReview",
    "auditTrail",
    "roleCockpitConfig",
    "adminConsoleConfig",
    "automatedReminderPlan",
    "decisionPackExport",
    "decisionPackImport",
    "outcomeProofEngine",
    "decisionMemoryLearning",
    "boardToValueMapping",
    "autonomousGovernanceOperatingPlan",
    "complianceEvidenceScore",
    "scopeCreepRadar",
    "approvalSimulation",
    "executiveSteeringRoom",
    "decisionKnowledgeGraph",
    "aiReadinessPromptGovernance"
  ]) {
    checkValue(productSource.includes(`function ${symbol}`), `${symbol} is implemented`);
  }
  checkValue(productSource.includes("auditPack"), "Decision Pack includes Audit Pack section");
  checkValue(productSource.includes("rrule"), "Reminder plan includes schedule metadata");
}

const failed = checks.filter((check) => !check.pass);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
} else {
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
  }
}

if (failed.length) {
  process.exitCode = 1;
}

function checkFile(relativePath, name) {
  checkValue(existsSync(path.join(pluginRoot, relativePath)), name);
}

function checkValue(pass, name) {
  checks.push({ name, pass: Boolean(pass) });
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(pluginRoot, relativePath), "utf8"));
  } catch {
    checkValue(false, `${relativePath} parses as JSON`);
    return null;
  }
}

function readText(relativePath) {
  try {
    return readFileSync(path.join(pluginRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

function containsPlaceholder(value) {
  return typeof value !== "string" || /example\.invalid|TODO_|your-owned-domain|00000000-0000-0000-0000-000000000000|<[^>]+>|support@example/i.test(value);
}
