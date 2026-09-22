# Spec Delta

## Purpose

Connect OpenCode 2 tool executions to the shared lint write policy so that `write`, `edit`, and patch tool calls violating the policy are denied before they touch the filesystem.

## ADDED Requirements

### Requirement: Violating write and edit tool calls are denied

The OpenCode integration SHALL register a pre-execution tool hook that routes `write` and `edit` tool executions into the write policy, mapping the V2 `path` argument onto the policy's file-path contract, and SHALL deny a violating execution by raising an error that carries the policy's reason so the model receives it as the tool failure. Compliant executions and tools outside the routed set SHALL proceed unaffected.

#### Scenario: Write inserting a suppression comment is denied

- **WHEN** the `write` tool is called with a `path` and `content` containing a new `// @ts-ignore`
- **THEN** the tool execution is denied before any file is written, and the error text contains the policy reason

#### Scenario: Edit touching a protected config is denied

- **WHEN** the `edit` tool is called with `path` pointing at `.oxlintrc.json`
- **THEN** the tool execution is denied and the error text names the protected file

#### Scenario: Compliant edit is allowed

- **WHEN** the `edit` tool is called on a source file without introducing suppression markers
- **THEN** the tool executes normally

#### Scenario: Non-routed tools are unaffected

- **WHEN** a tool other than `write`, `edit`, or a patch tool (for example `read` or `grep`) is executed
- **THEN** the hook does not apply policy checks to it

### Requirement: Violating patch tool calls are denied

The OpenCode integration SHALL route patch tool executions — recognized under either the `patch` or `apply_patch` tool name and carrying a `patchText` payload — into the write policy, and SHALL deny the entire tool execution when any file section violates the policy.

#### Scenario: Patch adding a suppression marker is denied

- **WHEN** a patch tool is called with `patchText` containing a `+` line with an `eslint-disable` marker
- **THEN** the entire tool execution is denied and the error names the offending file

#### Scenario: Patch touching a protected config is denied

- **WHEN** a patch tool is called with a section targeting `.oxlintrc.json`
- **THEN** the entire tool execution is denied

#### Scenario: Both tool-name spellings are recognized

- **WHEN** the patch payload arrives under the tool name `apply_patch` instead of `patch`
- **THEN** it is routed to the policy the same way

### Requirement: The integration is a V2-only plugin

The OpenCode integration SHALL default-export a V2 plugin definition with a stable identifier, SHALL depend on `@opencode/plugin`, and SHALL be discoverable from `.opencode/plugins/` without additional configuration. It SHALL NOT provide a V1 `server()` entrypoint; OpenCode 1 is unsupported by design.

#### Scenario: Plugin is active under OpenCode 2

- **WHEN** OpenCode 2 loads a project whose `.opencode/plugins/` re-exports this plugin
- **THEN** the plugin appears in the active plugin list under its stable identifier and its hook blocks a `// @ts-ignore` insertion

#### Scenario: No V1 entrypoint exists

- **WHEN** the plugin module is inspected
- **THEN** it exposes the V2 definition as its default export and no V1 `server()` hook factory

#### Scenario: Consumer dependency contract

- **WHEN** a consumer follows the README integration guide
- **THEN** the documented dependency is `@opencode/plugin` (not `@opencode-ai/plugin`) and no config-file changes are required beyond the `.opencode/plugins/` re-export file
