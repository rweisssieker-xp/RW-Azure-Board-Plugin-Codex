import assert from "node:assert/strict";
import { AzureBoardsAuth } from "../dist/auth.js";
import { AzureDevOpsClient } from "../dist/azureDevOps.js";

const organization = process.env.AZURE_BOARDS_LIVE_ORG;
const project = process.env.AZURE_BOARDS_LIVE_PROJECT;

if (!organization || !project) {
  console.log("Skipping live smoke test: set AZURE_BOARDS_LIVE_ORG and AZURE_BOARDS_LIVE_PROJECT.");
  process.exit(0);
}

const auth = new AzureBoardsAuth();
const client = new AzureDevOpsClient(auth);

const status = await auth.status();
assert.equal(status.configured, true, "Set AZURE_BOARDS_PAT, AZURE_DEVOPS_PAT, AZURE_BOARDS_BEARER_TOKEN, or OAuth config.");

const query = await client.queryWorkItems({
  organization,
  project,
  wiql: `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.TeamProject] = '${project.replace(/'/g, "''")}' ORDER BY [System.ChangedDate] DESC`,
  top: 5
});

assert.ok(Array.isArray(query.workItems));
console.log(`Live smoke test passed: queried ${query.workItems.length} Work Items from ${organization}/${project}.`);
