import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
const AZURE_DEVOPS_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";
const DEFAULT_SCOPES = `${AZURE_DEVOPS_RESOURCE}/.default offline_access openid profile`;
export class AuthRequiredError extends Error {
    constructor(message = "Azure Boards authentication is required. Set AZURE_BOARDS_PAT or run azure_boards_login first.") {
        super(message);
        this.name = "AuthRequiredError";
    }
}
export class AzureBoardsAuth {
    tenantId = process.env.AZURE_BOARDS_TENANT_ID || "common";
    clientId = process.env.AZURE_BOARDS_CLIENT_ID || "";
    scopes = process.env.AZURE_BOARDS_SCOPES || DEFAULT_SCOPES;
    pat = process.env.AZURE_BOARDS_PAT || process.env.AZURE_DEVOPS_PAT || "";
    bearerToken = process.env.AZURE_BOARDS_BEARER_TOKEN || "";
    cachePath = process.env.AZURE_BOARDS_TOKEN_CACHE ||
        join(process.env.LOCALAPPDATA || join(homedir(), ".codex"), "CodexAzureBoards", "token-cache.json");
    async login() {
        if (!this.clientId) {
            return {
                ok: false,
                error: "AZURE_BOARDS_CLIENT_ID is not set.",
                nextStep: "Create a Microsoft Entra public-client app with Azure DevOps delegated permissions, then set AZURE_BOARDS_CLIENT_ID before running azure_boards_login."
            };
        }
        const device = await this.postForm(this.deviceCodeUrl(), {
            client_id: this.clientId,
            scope: this.scopes
        });
        const startedAt = Date.now();
        const intervalMs = Math.max(5, device.interval || 5) * 1000;
        while (Date.now() - startedAt < device.expires_in * 1000) {
            await sleep(intervalMs);
            const token = await this.postForm(this.tokenUrl(), {
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                client_id: this.clientId,
                device_code: device.device_code
            }, false);
            if (token.access_token) {
                await this.saveToken(token);
                return {
                    ok: true,
                    message: "Azure Boards login completed.",
                    scope: token.scope,
                    tokenType: token.token_type
                };
            }
            if (token.error === "authorization_pending") {
                continue;
            }
            if (token.error === "slow_down") {
                await sleep(intervalMs);
                continue;
            }
            throw new Error(token.error_description || token.error || "Device login failed.");
        }
        return {
            ok: false,
            verificationUri: device.verification_uri,
            userCode: device.user_code,
            message: device.message,
            error: "Device login timed out. Run azure_boards_login again."
        };
    }
    async getAuthorizationHeader() {
        if (this.pat) {
            return `Basic ${Buffer.from(`:${this.pat}`, "utf8").toString("base64")}`;
        }
        if (this.bearerToken) {
            return `Bearer ${this.bearerToken}`;
        }
        return `Bearer ${await this.getAccessToken()}`;
    }
    async getAccessToken() {
        const cache = await this.readCache();
        if (!cache) {
            throw new AuthRequiredError();
        }
        if (cache.expiresAt > Date.now() + 60_000) {
            return cache.accessToken;
        }
        if (!cache.refreshToken || !this.clientId) {
            throw new AuthRequiredError("Azure Boards token expired. Run azure_boards_login again.");
        }
        const refreshed = await this.postForm(this.tokenUrl(), {
            grant_type: "refresh_token",
            client_id: this.clientId,
            refresh_token: cache.refreshToken,
            scope: this.scopes
        });
        await this.saveToken(refreshed);
        return refreshed.access_token;
    }
    async status() {
        const cache = await this.readCache();
        return {
            configured: Boolean(this.clientId || this.pat || this.bearerToken),
            authMode: this.pat ? "pat" : this.bearerToken ? "bearer-token" : cache ? "oauth-cache" : this.clientId ? "oauth-device-code" : "not-configured",
            patConfigured: Boolean(this.pat),
            bearerTokenConfigured: Boolean(this.bearerToken),
            oauthClientConfigured: Boolean(this.clientId),
            tenantId: this.tenantId,
            scopes: this.scopes,
            cachePath: this.cachePath,
            loggedIn: Boolean(cache),
            expiresAt: cache ? new Date(cache.expiresAt).toISOString() : null
        };
    }
    deviceCodeUrl() {
        return `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/devicecode`;
    }
    tokenUrl() {
        return `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`;
    }
    async saveToken(token) {
        if (!token.access_token) {
            throw new Error(token.error_description || token.error || "Token response did not include an access token.");
        }
        const cache = {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt: Date.now() + token.expires_in * 1000,
            scope: token.scope
        };
        await mkdir(dirname(this.cachePath), { recursive: true });
        await writeFile(this.cachePath, JSON.stringify(cache, null, 2), { encoding: "utf8", mode: 0o600 });
    }
    async readCache() {
        try {
            return JSON.parse(await readFile(this.cachePath, "utf8"));
        }
        catch {
            return null;
        }
    }
    async postForm(url, body, throwOnHttpError = true) {
        const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(body)
        });
        const json = (await response.json());
        if (!response.ok && throwOnHttpError) {
            throw new Error(String(json.error_description || json.error || `HTTP ${response.status}`));
        }
        return json;
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
