const SEVERITIES = ["info", "low", "medium", "high", "critical"];
const STRING_ARRAY_RULES = [
    "allowedTypes",
    "requiredTags",
    "requiredFields",
    "blockedKeywords",
    "decisionKeywords",
    "customerKeywords",
    "blockedStates",
    "closedStates",
    "evidenceRequirements"
];
const POSITIVE_NUMBER_RULES = ["slaDays", "staleDays", "blockedDays", "highPriorityThreshold", "maxItems", "maxActions"];
const STRING_RULES = ["defaultOwner", "staleTag", "blockedTag", "escalationTag", "evidenceTag"];
const NUMBER_MAP_RULES = ["driftThresholds", "riskWeights"];
export function validatePolicyPack(policyPack) {
    const errors = [];
    const warnings = [];
    if (!isObject(policyPack)) {
        return result(errors.concat("policyPack must be an object."), warnings, null);
    }
    const kind = stringValue(policyPack.kind) || "azureBoards.policyPack";
    if (kind !== "azureBoards.policyPack") {
        errors.push("kind must be 'azureBoards.policyPack' when provided.");
    }
    const version = numberValue(policyPack.version) ?? 1;
    if (version !== 1) {
        errors.push("version must be 1.");
    }
    const id = stringValue(policyPack.id) || slugify(stringValue(policyPack.name) || "policy-pack");
    const name = stringValue(policyPack.name);
    if (!name)
        errors.push("name is required.");
    if (!isId(id))
        errors.push("id must contain only letters, numbers, dots, underscores, or hyphens.");
    const defaults = normalizeRules(objectValue(policyPack.defaults), "defaults", errors, warnings);
    const policies = normalizePolicies(policyPack.policies, defaults, errors, warnings);
    if (!policies.length)
        errors.push("policies must contain at least one policy.");
    const normalized = {
        kind: "azureBoards.policyPack",
        version: 1,
        id,
        name: name || id,
        defaults,
        policies
    };
    const description = stringValue(policyPack.description);
    if (description)
        normalized.description = description;
    const owner = stringValue(policyPack.owner);
    if (owner)
        normalized.owner = owner;
    const appliesTo = normalizeScope(policyPack.appliesTo, errors);
    if (appliesTo)
        normalized.appliesTo = appliesTo;
    const metadata = objectValue(policyPack.metadata);
    if (metadata)
        normalized.metadata = metadata;
    warnUnknownKeys(policyPack, ["kind", "version", "id", "name", "description", "owner", "appliesTo", "defaults", "policies", "metadata"], "policyPack", warnings);
    return result(errors, warnings, errors.length ? null : normalized);
}
function normalizePolicies(input, defaults, errors, warnings) {
    if (Array.isArray(input)) {
        return input.flatMap((policy, index) => normalizePolicy(policy, `policies[${index}]`, defaults, errors, warnings));
    }
    if (isObject(input)) {
        return Object.entries(input).flatMap(([key, policy]) => normalizePolicy(policy, `policies.${key}`, defaults, errors, warnings, key));
    }
    errors.push("policies must be an array or object map.");
    return [];
}
function normalizePolicy(input, path, defaults, errors, warnings, mapKey) {
    if (!isObject(input)) {
        errors.push(`${path} must be an object.`);
        return [];
    }
    const id = stringValue(input.id) || (mapKey ? slugify(mapKey) : "");
    const name = stringValue(input.name) || stringValue(input.title) || mapKey || id;
    if (!id)
        errors.push(`${path}.id is required.`);
    if (id && !isId(id))
        errors.push(`${path}.id must contain only letters, numbers, dots, underscores, or hyphens.`);
    if (!name)
        errors.push(`${path}.name is required.`);
    const severityInput = stringValue(input.severity);
    const severity = SEVERITIES.includes(severityInput) ? severityInput : "medium";
    if (severityInput && severityInput !== severity)
        errors.push(`${path}.severity must be one of ${SEVERITIES.join(", ")}.`);
    const rulesSource = objectValue(input.rules) || input;
    const rules = { ...defaults, ...normalizeRules(rulesSource, `${path}.rules`, errors, warnings) };
    if (!Object.keys(rules).length)
        warnings.push(`${path} has no configured rules.`);
    const normalized = {
        id,
        name: name || id,
        severity,
        enabled: booleanValue(input.enabled) ?? true,
        rules
    };
    const description = stringValue(input.description);
    if (description)
        normalized.description = description;
    const remediation = normalizeRemediation(input.remediation, `${path}.remediation`, errors);
    if (remediation)
        normalized.remediation = remediation;
    warnUnknownKeys(input, ["id", "name", "title", "description", "severity", "enabled", "rules", "remediation", ...ruleKeys()], path, warnings);
    return [normalized];
}
function normalizeRules(input, path, errors, warnings) {
    const rules = {};
    if (!input)
        return rules;
    for (const key of STRING_ARRAY_RULES) {
        const values = stringArray(input[key], `${path}.${key}`, errors);
        if (values)
            rules[key] = values;
    }
    for (const key of POSITIVE_NUMBER_RULES) {
        const value = positiveNumber(input[key], `${path}.${key}`, errors);
        if (value !== undefined)
            rules[key] = value;
    }
    for (const key of STRING_RULES) {
        const value = stringValue(input[key]);
        if (value)
            rules[key] = value;
    }
    for (const key of NUMBER_MAP_RULES) {
        const value = numberMap(input[key], `${path}.${key}`, errors);
        if (value)
            rules[key] = value;
    }
    const transitions = transitionsValue(input.allowedTransitions, `${path}.allowedTransitions`, errors);
    if (transitions)
        rules.allowedTransitions = transitions;
    warnUnknownKeys(input, ruleKeys(), path, warnings);
    return rules;
}
function normalizeScope(input, errors) {
    if (input === undefined)
        return undefined;
    if (!isObject(input)) {
        errors.push("appliesTo must be an object when provided.");
        return undefined;
    }
    const scope = {};
    for (const key of ["organization", "project", "team", "areaPath", "iterationPath"]) {
        const value = stringValue(input[key]);
        if (value)
            scope[key] = value;
    }
    return Object.keys(scope).length ? scope : undefined;
}
function normalizeRemediation(input, path, errors) {
    if (input === undefined)
        return undefined;
    if (!isObject(input)) {
        errors.push(`${path} must be an object when provided.`);
        return undefined;
    }
    const remediation = {};
    const owner = stringValue(input.owner);
    if (owner)
        remediation.owner = owner;
    const action = stringValue(input.action);
    if (action)
        remediation.action = action;
    if (input.patchPreview !== undefined) {
        if (!Array.isArray(input.patchPreview) || !input.patchPreview.every(isObject)) {
            errors.push(`${path}.patchPreview must be an array of JSON Patch operation objects.`);
        }
        else {
            remediation.patchPreview = input.patchPreview;
        }
    }
    return Object.keys(remediation).length ? remediation : undefined;
}
function stringArray(input, path, errors) {
    if (input === undefined)
        return undefined;
    if (!Array.isArray(input)) {
        errors.push(`${path} must be an array of strings.`);
        return undefined;
    }
    const values = unique(input.map(stringValue).filter((value) => value.length > 0));
    if (values.length !== input.length)
        errors.push(`${path} must contain only non-empty strings.`);
    return values;
}
function transitionsValue(input, path, errors) {
    if (input === undefined)
        return undefined;
    if (!Array.isArray(input)) {
        errors.push(`${path} must be an array of transition objects.`);
        return undefined;
    }
    const transitions = [];
    input.forEach((entry, index) => {
        if (!isObject(entry)) {
            errors.push(`${path}[${index}] must be an object.`);
            return;
        }
        const from = stringValue(entry.from);
        const to = stringValue(entry.to);
        if (!from || !to) {
            errors.push(`${path}[${index}] must include non-empty from and to values.`);
            return;
        }
        transitions.push({ from, to });
    });
    return transitions;
}
function numberMap(input, path, errors) {
    if (input === undefined)
        return undefined;
    if (!isObject(input)) {
        errors.push(`${path} must be an object with numeric values.`);
        return undefined;
    }
    const values = {};
    for (const [key, value] of Object.entries(input)) {
        const normalized = positiveNumber(value, `${path}.${key}`, errors);
        if (normalized !== undefined)
            values[key] = normalized;
    }
    return values;
}
function positiveNumber(input, path, errors) {
    if (input === undefined)
        return undefined;
    if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) {
        errors.push(`${path} must be a positive number.`);
        return undefined;
    }
    return input;
}
function warnUnknownKeys(input, allowed, path, warnings) {
    const allowedSet = new Set(allowed);
    for (const key of Object.keys(input)) {
        if (!allowedSet.has(key))
            warnings.push(`${path}.${key} is not part of the policy pack schema and was ignored.`);
    }
}
function ruleKeys() {
    return [...STRING_ARRAY_RULES, ...POSITIVE_NUMBER_RULES, ...STRING_RULES, ...NUMBER_MAP_RULES, "allowedTransitions"];
}
function result(errors, warnings, normalized) {
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        normalized,
        writePerformed: false
    };
}
function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function objectValue(value) {
    return isObject(value) ? value : undefined;
}
function stringValue(value) {
    return typeof value === "string" ? value.trim() : "";
}
function numberValue(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function booleanValue(value) {
    return typeof value === "boolean" ? value : undefined;
}
function unique(values) {
    return [...new Set(values)];
}
function isId(value) {
    return /^[A-Za-z0-9._-]+$/.test(value);
}
function slugify(value) {
    const slug = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "policy-pack";
}
