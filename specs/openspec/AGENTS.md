# OpenSpec Agent Instructions

## Purpose
OpenSpec defines the single source of truth for product behavior, data contracts, and UI/UX rules. New features and changes must be proposed and documented here before implementation.

## When to Create or Update Specs
- New features or workflows
- Changes to persisted data, commands, or events
- UI changes that affect behavior, configuration, or defaults

## Spec Location and Naming
- Place specs under `specs/` using a concise, descriptive filename.
- One feature per spec. Use related sub-sections instead of multiple files.

## Required Sections
- Summary: What problem is solved and why.
- Scope: In-scope and out-of-scope behaviors.
- UX: Screens, flows, and user actions.
- Data Model: JSON fields, defaults, and migration rules.
- Commands/Events: Frontend/back-end contract and payloads.
- Error Handling: User-facing messages and failure states.
- Acceptance: 3-6 bullet points verifying expected behavior.

## Proposal Workflow
1. Draft spec updates under `specs/`.
2. Review for completeness and consistency with existing models.
3. Implement changes strictly following the spec.
4. Update the spec if implementation needs adjustments.

## Implementation Guardrails
- Ensure the related feature spec exists under `specs/` before coding.
- If a spec is missing, confirm with the user before creating a new `.md` spec file.
- When a user requests a new spec, add it under `specs/` and update `specs/index.md`.
- Update related frontend/backend spec files when behavior or commands change.
- Profile-related changes must update `specs/profiles.md` and the relevant frontend/backend specs.
- If you add or change IPC commands, update `specs/backend/commands.md`.
- If you change configuration UX or persistence, update `specs/frontend/config-form.md`.
- Profile specs must state that profiles capture the full basic settings config and where profiles are stored.

