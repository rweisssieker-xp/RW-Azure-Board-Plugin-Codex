# Privacy Policy

Publisher: Reiner Weisssieker

Product: Azure Board Plugin Codex for Codex and ChatGPT-compatible MCP clients.

## Data Processed

The plugin can process Azure DevOps and Azure Boards data that the authenticated user is allowed to access, including Work Item fields, comments, relations, revisions, attachment metadata, supplied evidence records, local snapshots, baselines, approval queues, audit trails, and Decision Pack exports.

## Authentication Data

The plugin supports Microsoft Entra OAuth, bearer-token, and local PAT-based development modes. Tokens, PATs, device-code data, and bearer values must not be written to reports, Decision Packs, screenshots, logs, or local artifacts. Production deployments should use Microsoft Entra OAuth with least-privilege Azure DevOps delegated permissions.

## Local Storage

Local artifact storage is used only for user-approved snapshots, baselines, approval queues, audit trails, reminders, and Decision Packs. The storage path is controlled by deployment configuration such as `AZURE_BOARDS_STORE_DIR`.

## External Processing

The plugin is designed to keep the product operating system deterministic and local by default. Any optional external model routing must be explicitly approved by the deploying organization and governed by its data policy.

## User Control

Users and administrators control which Azure DevOps organization, project, and Work Items are queried or modified. Write-capable workflows require explicit preview and approval before applying changes.

## Contact

Support contact: rweisssieker@gmail.com
