# Azure Board Plugin Codex Onboarding Wizard

Use `azure_boards_product_onboarding_wizard` when a user starts with the plugin or switches role context.

## First Run Flow

1. Run `azure_boards_auth_status`.
2. Query a small Work Item sample.
3. Choose the user role: Product Owner, Scrum Master, CIO, Compliance, Release Manager, or Admin.
4. Validate the recommended policy pack with `azure_boards_validate_policy_pack`.
5. Run the suggested cockpit or watchlist tool.
6. Convert selected recommendations into `azure_boards_product_approval_queue`.
7. Export a Decision Pack when a decision, audit, or handover is needed.

## Built-In Role Paths

- Product Owner: project cockpit, action plan, approval queue, Decision Pack.
- Scrum Master: watchlist, bottleneck mining, Scrum policy pack, cleanup queue.
- CIO: executive steering room, Board-to-Value map, outcome proof, steering Decision Pack.
- Compliance: compliance evidence score, audit decision log, approval audit trail.
- Release Manager: release governance pack, release readiness review, result verification.
- Admin: safe apply governance pack, admin console, AI readiness and prompt governance.

## Success Signal

A first-time user should be able to connect, select a role, run one evidence-backed report, validate one policy pack, and produce one auditable next action in under 10 minutes.
