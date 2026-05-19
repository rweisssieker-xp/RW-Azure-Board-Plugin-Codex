import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AzureBoardsAuth } from "../dist/auth.js";

test("PAT auth creates Azure DevOps Basic authorization header", async () => {
  withEnv({ AZURE_BOARDS_PAT: "pat-secret", AZURE_BOARDS_BEARER_TOKEN: "", AZURE_BOARDS_CLIENT_ID: "" });
  const auth = new AzureBoardsAuth();
  assert.equal(await auth.getAuthorizationHeader(), `Basic ${Buffer.from(":pat-secret", "utf8").toString("base64")}`);
});

test("bearer token auth is used when PAT is absent", async () => {
  withEnv({ AZURE_BOARDS_PAT: "", AZURE_DEVOPS_PAT: "", AZURE_BOARDS_BEARER_TOKEN: "access-token", AZURE_BOARDS_CLIENT_ID: "" });
  const auth = new AzureBoardsAuth();
  assert.equal(await auth.getAuthorizationHeader(), "Bearer access-token");
});

test("PAT takes precedence over bearer token", async () => {
  withEnv({ AZURE_BOARDS_PAT: "pat-secret", AZURE_BOARDS_BEARER_TOKEN: "access-token", AZURE_BOARDS_CLIENT_ID: "" });
  const auth = new AzureBoardsAuth();
  assert.equal(await auth.getAuthorizationHeader(), `Basic ${Buffer.from(":pat-secret", "utf8").toString("base64")}`);
});

test("auth status reports mode without exposing token or PAT values", async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), "azure-boards-auth-"));
  const cachePath = join(cacheDir, "token-cache.json");
  await writeFile(
    cachePath,
    JSON.stringify({
      accessToken: "cached-access-token-secret",
      refreshToken: "cached-refresh-token-secret",
      expiresAt: Date.now() + 3_600_000,
      scope: "scope"
    }),
    "utf8"
  );

  try {
    withEnv({
      AZURE_BOARDS_PAT: "",
      AZURE_DEVOPS_PAT: "",
      AZURE_BOARDS_BEARER_TOKEN: "",
      AZURE_BOARDS_CLIENT_ID: "client-id",
      AZURE_BOARDS_TOKEN_CACHE: cachePath
    });
    const auth = new AzureBoardsAuth();
    const status = await auth.status();
    const serialized = JSON.stringify(status);

    assert.equal(status.authMode, "oauth-cache");
    assert.equal(status.loggedIn, true);
    assert.doesNotMatch(serialized, /cached-access-token-secret|cached-refresh-token-secret|pat-secret|access-token/);
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
});

function withEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === "") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
