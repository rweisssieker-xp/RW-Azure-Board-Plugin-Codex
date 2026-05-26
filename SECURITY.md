# Security Policy

## Supported Project

Security reports should target the current `main` branch of Azure Board Plugin Codex.

## Reporting A Vulnerability

Please report security issues privately by email:

`rweisssieker@gmail.com`

Do not open public GitHub issues for suspected vulnerabilities, exposed credentials, authentication bypasses, token handling problems, or data leakage.

## Sensitive Data

Do not include real Azure DevOps PATs, bearer tokens, Microsoft Entra secrets, device codes, tenant secrets, customer Work Item data, attachment contents, or private board exports in public issues, pull requests, screenshots, logs, or sample files.

## Expected Handling

The maintainer will review reports as soon as practical, ask for reproduction details if needed, and coordinate a fix before public disclosure when the issue is confirmed.

## Scope

In scope:

- MCP server authentication and authorization behavior.
- Token, PAT, bearer-token, and device-code handling.
- Hosted MCP transport and request handling.
- Local artifact storage for snapshots, baselines, approval queues, audit trails, and Decision Packs.
- Secret redaction in errors, logs, reports, and UI output.

Out of scope:

- Vulnerabilities in Microsoft Azure DevOps or Microsoft Entra services.
- Social engineering.
- Denial-of-service tests against infrastructure you do not own.
- Reports based only on missing production deployment values in this repository.
