# Design

## Context

See proposal.md for motivation. The core policy engine (`src/enforce-write-policy.mjs`) is host-agnostic: it accepts a ctx of `{ tool_name, tool_input, cwd }`, sniffs payload shapes (`content` = write, `oldString`/`newString` = edit, `edits[]` = multiedit), and returns `{ decision: 'block', reason }` or `null`. Two hosts consume it today: the Claude Code stdin hook and the OpenCode plugin. The plugin is written against the OpenCode 1 plugin API (`@opencode-ai/plugin`, returned `tool.execute.before` hook, `{ directory }` argument, `filePath` tool argument), none of which exists in OpenCode 2. V2's tool catalog drops `multiedit` and adds a multi-file `patch` tool whose `patchText` payload matches no existing sniffing branch — it currently falls through to `null` (allowed). V2 patch grammar:

```text
*** Begin Patch
*** Add File: <path>        <- subsequent lines are all "+content"
+line
*** Update File: <path>     <- optional "*** Move to: <dest>"
@@
-removed
+added
 context
*** Delete File: <path>     <- nothing follows
*** End Patch
```

## Goals / Non-Goals

**Goals:**

- Keep the core as the single source of policy truth; hosts stay thin adapters.
- Close the `patch` bypass for both hosts (Claude gains it for free via the core).
- Produce a V2 plugin that passes the official ported-plugin verification checklist.

**Non-Goals:**

- Supporting OpenCode 1 (breaking change, accepted — see proposal.md).
- Enforcing policy over shell commands (`sed`, redirections) — unchanged from today, deferred to a separate change if ever.
- Intercepting via V2 permission hooks (`ctx.permission.hook('evaluate')`).
- Reconstructing post-patch file content for exact before/after marker counting.

## Decisions

**D1: V2-only plugin, no dual entrypoint.** The migration guide allows one object exposing both `setup()` (V2) and `server()` (V1 ≥ 1.18.29). Rejected: it forces consumers to install both `@opencode/plugin` and `@opencode-ai/plugin` indefinitely, still excludes older V1, and V2 replaces V1 by default (same `opencode` binary). Alternative kept: V1 users pin the previous release/tag of this project.

**D2: Intercept at `ctx.tool.hook('execute.before')`, block by throwing.** The policy's core job — counting suppression markers in *content being written* — is impossible from `ctx.permission.hook('evaluate')`, which sees only action + resource path. Throwing from the tool hook is the documented V2 blocking idiom and surfaces the reason to the model as a tool failure. Permission hooks remain a possible future complement, not a replacement.

**D3: Patch support lives in the core, not the adapter.** The core already owns "sniff unfamiliar payload shapes and map them to policy" (it does this for Claude's `new_string`/`old_text` variants). Putting patch parsing in the core means Claude and any future host inherit it, and the adapter stays a pure arg-mapping shim. Alternative rejected: adapter-side patch handling would duplicate per-host and leave the core with a silent `null` fallthrough.

**D4: Content check scans `+`-prefixed lines only (fail-closed), no reconstruction.** Applying chunks to existing content to reuse exact before/after counting requires implementing `@@`-anchor/context matching correctly — and any bug there is a *silent bypass*. Scanning `+` lines cannot under-count additions: every added line in a well-formed patch is `+`-prefixed, context and `-` lines are never flagged (so untouched existing suppressions don't block, and removing suppressions still passes). Known over-block: a `+` line that *keeps* an existing marker while changing something else on the line is denied even though the count didn't increase. Accepted: false positives cost a two-step edit; false negatives cost the policy.

**D5: Malformed patch payloads fail closed.** If a payload is identified as a patch (has `patchText` / patch markers) but cannot be parsed into file sections, deny it with a "could not be verified" reason. This deliberately diverges from the core's general try/catch-fail-open behavior for this one payload class, because "unparseable" is exactly what an evasion attempt looks like. Risk: exotic but legitimate patch formatting gets denied — mitigated by mirroring OpenCode's own parser conventions (trim, Begin/End markers) and falling back to a raw `+`-line scan when only the envelope wrapper is off.

**D6: Whole-patch denial with every offending file named.** A tool execution throws at most once, so one violating section denies the patch. The reason aggregates all offending files/markers so the model can fix everything in one retry rather than whack-a-mole.

**D7: Adapter normalizes V2 names defensively.** Map `event.input.path` → `file_path`; recognize both `patch` and `apply_patch` tool names (sources disagree on the spelling across versions); keep core sniffing tolerant of `edits[]` even though V2 has no `multiedit`. Plugin id: `you-lint-not-pass`.

## Risks / Trade-offs

- [`+`-line scan over-blocks lines that merely retain a marker] → Reason text points at the marker; the documented workaround is splitting the edit. Trade accepted in D4.
- [Patch grammar drift between OpenCode versions] → Parser follows the documented envelope/header grammar; unknown constructs between headers are skipped, never executed; D5 fail-closed covers total parse failure.
- [`execute.before` may not fire for nested tool calls inside Code Mode (`execute`)] → Add an implementation-time verification task (probe with a nested `write`); if hooks don't fire there, document as a limitation and consider a permission-rule follow-up change — nested code-mode calls still enforce *permissions*, so a future `edit`-action deny rule is the backstop.
- [Core's outer try/catch still fails open on unexpected exceptions for write/edit] → Pre-existing behavior kept to avoid breaking Claude/OpenCode on policy bugs; patch path opts out per D5. Revisit as its own change if desired.
- [README/install drift leaves consumers on broken V1 plugin] → README Step 3 + Template table + `.opencode/package.json` updated in the same change; integration guide is the single documented install path.

## Migration Plan

1. Land core patch support + tests first (host-agnostic, verifiable via `bun test` alone).
2. Port the plugin and update `.opencode/package.json`.
3. Update README (Step 3 dependency pin, Template table, note V2-only).
4. Consumers: re-export path unchanged; they only bump the dependency to `@opencode/plugin` on upgrading OpenCode. OpenCode 1 consumers stay on the previous release of this project.
5. Rollback: revert the change; consumers on OpenCode 1 were never broken by it (V2-only plugin simply fails to load there... it is not loaded by design).

## Open Questions

- Does `tool.execute.before` fire for tool calls nested inside Code Mode `execute`? Resolved by a verification task during implementation; if the answer is "no", the remediation (permission-rule backstop) is scoped as a follow-up change rather than altering this design.
