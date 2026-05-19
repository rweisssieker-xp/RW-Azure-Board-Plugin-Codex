const REDACTED = "[REDACTED]";

const SENSITIVE_KEY_PATTERN = /(token|secret|password|passwd|pwd|pat|credential|authorization|api[-_]?key|client[-_]?secret|refresh[-_]?token|access[-_]?token)/i;
const ASSIGNMENT_PATTERN = /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|PWD|PAT|API_KEY|CLIENT_SECRET|AUTHORIZATION)[A-Z0-9_]*)\s*=\s*([^\s"'`,;]+)/gi;
const GENERIC_SECRET_ASSIGNMENT_PATTERN = /\b(token|secret|password|passwd|pwd|pat|api_key|client_secret|authorization)\s*=\s*([^\s"'`,;]+)/gi;
const JSON_ASSIGNMENT_PATTERN = /(["']?)([A-Za-z0-9_.-]*(?:token|secret|password|passwd|pwd|pat|apiKey|api_key|clientSecret|client_secret|authorization)[A-Za-z0-9_.-]*)\1\s*:\s*(["'])(.*?)\3/gi;
const AUTH_HEADER_PATTERN = /\b(Basic|Bearer)\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_QUERY_PATTERN = /([?&](?:access_token|refresh_token|token|pat|api_key|client_secret|password|code)=)([^&#\s]+)/gi;

export function redactSecrets<T>(value: T): T {
  return redactValue(value, new WeakSet()) as T;
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name && error.name !== "Error" ? `${error.name}: ` : "";
    return redactString(`${name}${error.message || "Unknown error"}`);
  }
  if (typeof error === "string") {
    return redactString(error);
  }
  try {
    return redactString(JSON.stringify(redactSecrets(error)));
  } catch {
    return "Unknown error";
  }
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
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
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(entry, seen);
  }
  return output;
}

function redactString(value: string): string {
  return value
    .replace(AUTH_HEADER_PATTERN, (_match, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(ASSIGNMENT_PATTERN, (_match, key: string) => `${key}=${REDACTED}`)
    .replace(GENERIC_SECRET_ASSIGNMENT_PATTERN, (_match, key: string) => `${key}=${REDACTED}`)
    .replace(JSON_ASSIGNMENT_PATTERN, (_match, quote: string, key: string, valueQuote: string) => `${quote}${key}${quote}: ${valueQuote}${REDACTED}${valueQuote}`)
    .replace(SECRET_QUERY_PATTERN, (_match, prefix: string) => `${prefix}${REDACTED}`);
}
