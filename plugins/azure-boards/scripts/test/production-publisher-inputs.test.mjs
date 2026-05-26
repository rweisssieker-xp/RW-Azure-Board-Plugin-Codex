import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";

const scriptsRoot = process.cwd();
const applyScript = path.join(scriptsRoot, "apply-production-publisher-inputs.mjs");

test("production publisher input script applies real values to manifest and submission", () => {
  const pluginRoot = mkdtempSync(path.join(tmpdir(), "azure-boards-plugin-"));
  mkdirSync(path.join(pluginRoot, ".codex-plugin"), { recursive: true });

  writeJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"), {
    author: {
      name: "Development Publisher",
      email: "support@example.invalid",
      url: "https://example.invalid/dev"
    },
    homepage: "https://example.invalid/azure-boards",
    repository: "https://example.invalid/repository",
    interface: {
      developerName: "Development Publisher",
      websiteURL: "https://example.invalid/azure-boards",
      privacyPolicyURL: "https://example.invalid/privacy",
      termsOfServiceURL: "https://example.invalid/terms"
    }
  });
  writeJson(path.join(pluginRoot, "chatgpt-app-submission.json"), {
    schema_version: 1,
    app_info: { display_name: "Azure Boards" }
  });

  const inputPath = path.join(pluginRoot, "production-publisher-inputs.json");
  writeJson(inputPath, {
    publisherName: "Contoso Delivery Systems",
    supportEmail: "support@contoso.example",
    authorUrl: "https://contoso.example",
    homepageUrl: "https://contoso.example/azure-boards",
    repositoryUrl: "https://contoso.example/azure-boards/support",
    websiteUrl: "https://contoso.example/azure-boards",
    privacyPolicyUrl: "https://contoso.example/azure-boards/privacy",
    termsOfServiceUrl: "https://contoso.example/azure-boards/terms",
    hostedMcpUrl: "https://contoso.example/azure-boards/mcp",
    entraClientId: "11111111-2222-3333-4444-555555555555",
    entraTenantId: "organizations"
  });

  const result = spawnSync(process.execPath, [applyScript, inputPath], {
    cwd: scriptsRoot,
    env: { ...process.env, AZURE_BOARDS_PLUGIN_ROOT: pluginRoot },
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);

  const manifest = readJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"));
  assert.equal(manifest.author.name, "Contoso Delivery Systems");
  assert.equal(manifest.author.email, "support@contoso.example");
  assert.equal(manifest.homepage, "https://contoso.example/azure-boards");
  assert.equal(manifest.interface.privacyPolicyURL, "https://contoso.example/azure-boards/privacy");

  const submission = readJson(path.join(pluginRoot, "chatgpt-app-submission.json"));
  assert.equal(submission.production.support_email, "support@contoso.example");
  assert.equal(submission.production.hosted_mcp_url, "https://contoso.example/azure-boards/mcp");
  assert.equal(submission.production.microsoft_entra.client_id, "11111111-2222-3333-4444-555555555555");
});

test("production publisher input script rejects placeholder values", () => {
  const pluginRoot = mkdtempSync(path.join(tmpdir(), "azure-boards-plugin-"));
  const inputPath = path.join(pluginRoot, "production-publisher-inputs.json");
  writeJson(inputPath, {
    publisherName: "RW Local Productivity",
    supportEmail: "support@your-owned-domain.example",
    authorUrl: "https://your-owned-domain.example",
    homepageUrl: "https://your-owned-domain.example/azure-boards",
    repositoryUrl: "https://your-owned-domain.example/azure-boards/support",
    websiteUrl: "https://your-owned-domain.example/azure-boards",
    privacyPolicyUrl: "https://your-owned-domain.example/azure-boards/privacy",
    termsOfServiceUrl: "https://your-owned-domain.example/azure-boards/terms",
    hostedMcpUrl: "https://your-owned-domain.example/azure-boards/mcp",
    entraClientId: "00000000-0000-0000-0000-000000000000",
    entraTenantId: "organizations"
  });

  const result = spawnSync(process.execPath, [applyScript, inputPath], {
    cwd: scriptsRoot,
    env: { ...process.env, AZURE_BOARDS_PLUGIN_ROOT: pluginRoot },
    encoding: "utf8"
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /supportEmail must be set to a real production value/);
  assert.match(result.stderr, /entraClientId must be set to a real production value/);
});

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
