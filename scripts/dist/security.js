const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(token|secret|password|passwd|pwd|pat|credential|authorization|api[-_]?key|client[-_]?secret|refresh[-_]?token|access[-_]?token)/i;
const ASSIGNMENT_PATTERN = /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|PWD|PAT|API_KEY|CLIENT_SECRET|AUTHORIZATION)[A-Z0-9_]*)\s*=\s*([^\s"'`,;]+)/gi;
const GENERIC_SECRET_ASSIGNMENT_PATTERN = /\b(token|secret|password|passwd|pwd|pat|api_key|client_secret|authorization)\s*=\s*([^\s"'`,;]+)/gi;
const JSON_ASSIGNMENT_PATTERN = /(["']?)([A-Za-z0-9_.-]*(?:token|secret|password|passwd|pwd|pat|apiKey|api_key|clientSecret|client_secret|authorization)[A-Za-z0-9_.-]*)\1\s*:\s*(["'])(.*?)\3/gi;
const AUTH_HEADER_PATTERN = /\b(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_QUERY_PATTERN = /([?&](?:access_token|refresh_token|token|pat|api_key|client_secret|password|code)=)([^&#\s]+)/gi;
export function redactSecrets(value) {
    return redactValue(value, new WeakSet());
}
export function safeErrorMessage(error) {
    if (error instanceof Error) {
        const name = error.name && error.name !== "Error" ? `${error.name}: ` : "";
        return redactString(`${name}${error.message || "Unknown error"}`);
    }
    if (typeof error === "string") {
        return redactString(error);
    }
    try {
        return redactString(JSON.stringify(redactSecrets(error)));
    }
    catch {
        return "Unknown error";
    }
}
function redactValue(value, seen) {
    if (typeof value === "string") {
        return redactString(value);
    }
    if (Array.isArray(value)) {
        return value.map((entry) => redactValue(entry, seen));
    }
    if (!value || typeof value !== "object") {
        return value;
    }
    if (seen.has(value)) {
        return "[Circular]";
    }
    seen.add(value);
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
        output[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(entry, seen);
    }
    return output;
}
function redactString(value) {
    return value
        .replace(AUTH_HEADER_PATTERN, (_match, scheme) => `${scheme} ${REDACTED}`)
        .replace(ASSIGNMENT_PATTERN, (_match, key) => `${key}=${REDACTED}`)
        .replace(GENERIC_SECRET_ASSIGNMENT_PATTERN, (_match, key) => `${key}=${REDACTED}`)
        .replace(JSON_ASSIGNMENT_PATTERN, (_match, quote, key, valueQuote) => `${quote}${key}${quote}: ${valueQuote}${REDACTED}${valueQuote}`)
        .replace(SECRET_QUERY_PATTERN, (_match, prefix) => `${prefix}${REDACTED}`);
}
