import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const pluginRoot = process.env.AZURE_BOARDS_PLUGIN_ROOT
  ? path.resolve(process.env.AZURE_BOARDS_PLUGIN_ROOT)
  : path.resolve(process.cwd(), "..");
const inputPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(pluginRoot, "production-publisher-inputs.json");

const inputs = readJson(inputPath);

const required = [
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
];

const failures = [];
for (const key of required) {
  if (isPlaceholder(inputs[key])) {
    failures.push(`${key} must be set to a real production value`);
  }
}

for (const key of [
  "authorUrl",
  "homepageUrl",
  "repositoryUrl",
  "websiteUrl",
  "privacyPolicyUrl",
  "termsOfServiceUrl",
  "hostedMcpUrl"
]) {
  if (!isHttpsUrl(inputs[key])) {
    failures.push(`${key} must be an https URL`);
  }
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputs.supportEmail ?? "")) {
  failures.push("supportEmail must be a valid email address");
}

if (failures.length) {
  for (const failure of failures) {
    console.error(`FAIL ${failure}`);
  }
  process.exit(1);
}

const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
const manifest = readJson(manifestPath);

manifest.author = {
  ...(manifest.author ?? {}),
  name: inputs.publisherName,
  email: inputs.supportEmail,
  url: inputs.authorUrl
};
manifest.homepage = inputs.homepageUrl;
manifest.repository = inputs.repositoryUrl;
manifest.interface = {
  ...(manifest.interface ?? {}),
  developerName: inputs.publisherName,
  websiteURL: inputs.websiteUrl,
  privacyPolicyURL: inputs.privacyPolicyUrl,
  termsOfServiceURL: inputs.termsOfServiceUrl
};

writeJson(manifestPath, manifest);

const submissionPath = path.join(pluginRoot, "chatgpt-app-submission.json");
const submission = readJson(submissionPath);
submission.production = {
  ...(submission.production ?? {}),
  publisher_name: inputs.publisherName,
  support_email: inputs.supportEmail,
  website_url: inputs.websiteUrl,
  privacy_policy_url: inputs.privacyPolicyUrl,
  terms_of_service_url: inputs.termsOfServiceUrl,
  hosted_mcp_url: inputs.hostedMcpUrl,
  microsoft_entra: {
    client_id: inputs.entraClientId,
    tenant_id: inputs.entraTenantId,
    auth_mode: "Microsoft Entra OAuth delegated Azure DevOps access"
  }
};

writeJson(submissionPath, submission);

console.log(`Updated production publisher metadata from ${inputPath}`);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isPlaceholder(value) {
  return (
    typeof value !== "string" ||
    value.trim() === "" ||
    /example\.invalid|your-owned-domain|TODO_SUBMISSION|00000000-0000-0000-0000-000000000000|<[^>]+>/i.test(value)
  );
}
