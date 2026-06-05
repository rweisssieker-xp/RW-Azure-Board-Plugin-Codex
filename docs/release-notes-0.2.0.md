# Release Notes 0.2.0

## Release Theme

Marketplace-ready root plugin with guided onboarding, role starter prompts, and an expanded policy pack catalog.

## Added

- `azure_boards_product_onboarding_wizard` for role-based first-run guidance.
- `azure_boards_product_policy_pack_catalog` for built-in policy pack discovery.
- `policy-packs/erp-cutover.json` for ERP cutover and go/no-go readiness.
- `policy-packs/safe-apply-governance.json` for approval queue, apply preview, result review, and audit controls.
- `docs/onboarding-wizard.md` and `docs/starter-prompts.md`.

## Changed

- Manifest marketplace links now point to root-level privacy and terms documents.
- Default prompts now cover onboarding, policy-pack discovery, approval queue, and Decision Pack flows.
- Package scripts match the distributed root plugin layout.

## Release Checks

- Root `.codex-plugin/plugin.json` is present.
- File count remains below the 128-file scan limit.
- No PNG, ZIP, PDF, or test artifacts are tracked.
- No `child_process`, `spawn`, or `spawnSync` patterns are present.
- Runtime JavaScript passes `node --check`.
