# Proposal

## Why

OpenCode 2 replaced the plugin API: V1 plugin implementations (like this project's `opencode/you-lint-not-pass-plugin.ts`) do not run in V2, so the lint policy is silently unenforced for anyone who upgrades OpenCode. V2 also ships a multi-file `patch` write tool whose input shape (`patchText`) the core policy engine does not recognize — an agent can use it to add suppression comments or rewrite protected lint configs without being blocked.

## What Changes

- **BREAKING** Rewrite the OpenCode plugin for the V2 API: `Plugin.define({ id, setup })` default export from `@opencode/plugin`, registering `ctx.tool.hook('execute.before')` instead of returning a `tool.execute.before` hook from a `@opencode-ai/plugin` function. V1 OpenCode is no longer supported (V2-only decision).
- Map V2 tool input (`path`) to the core's `file_path` contract; accept both `patch` and `apply_patch` tool-name spellings; drop the assumption that `multiedit` exists as a V2 tool.
- Teach the core policy engine (`src/enforce-write-policy.mjs`) about patch input: parse `*** Begin Patch` / `*** End Patch` envelopes, extract per-file section headers (`Add/Update/Delete File:`, `Move to:`), block sections that touch protected lint configs (including **delete**, which is currently unhandled for every host), and block patches whose `+` lines introduce suppression markers (conservative fail-closed scan; whole patch denied with every offending file named).
- Update consumer-facing integration docs and dependencies: `.opencode/package.json` and README Step 3/Template table move from `@opencode-ai/plugin` to `@opencode/plugin`; the `.opencode/plugins/` re-export path is unchanged (V2 still auto-discovers it).
- Extend the Bun test suite with patch-policy cases (protected-config delete, suppression in `+` lines, legitimate patch passes, multi-file block).

Out of scope: shell-based policy evasion (`sed -i`, redirections) remains unenforced, as today; interception stays on the tool hook rather than V2 permission hooks (content inspection requires seeing the payload).

## Capabilities

### New Capabilities

- `write-policy`: Core lint-write policy enforcement — protected lint-config edits (including deletion via patch) and inline suppression-comment detection across write/edit/patch payload shapes, shared by all host integrations.
- `opencode-integration`: OpenCode host integration — a V2-only plugin that adapts OpenCode tool executions (`write`, `edit`, `patch`/`apply_patch`) into the core policy's context and blocks violating calls.

### Modified Capabilities

(none — the project has no existing specs)

## Impact

- `opencode/you-lint-not-pass-plugin.ts` — full rewrite (V2 plugin API)
- `src/enforce-write-policy.mjs` — new patch parsing/enforcement path; `resolveToolName` payload sniffing for `patchText`; protected-config check applies to delete/move operations
- `.opencode/package.json` — dependency `@opencode-ai/plugin` → `@opencode/plugin`
- `README.md` — Integration Guide Step 3, Template Files table, dependency pin
- `claude/pre-tool-use.mjs` — no changes required (core ctx shape unchanged for Claude), but inherits the new patch capability if Claude ever sends such payloads
- `tests/enforce-write-policy.test.ts` — new patch cases; plugin adapter itself remains verified manually per the official V2 plugin checklist (plugin ID listed, hook blocks a `// @ts-ignore` insert, cleanup on reload)
