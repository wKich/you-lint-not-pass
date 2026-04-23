# You Lint Not Pass! 🧙‍♂️⚡

> *"You shall not pass!"* — A lint enforcement system that guards your code quality.

A portable lint enforcement system that prevents AI agents from:

1. **Editing lint configuration files** (e.g., `.oxlintrc.json`, `.eslintrc.json`, `biome.json`)
2. **Adding inline suppression comments** (e.g., `eslint-disable`, `oxlint-disable`, `biome-ignore`, `@ts-ignore`, `@ts-nocheck`)

## Features

- 🔒 **Blocks protected config edits**: Prevents modification of oxlint, ESLint, and Biome config files
- 🚫 **Blocks suppression comments**: Prevents adding `eslint-disable`/`eslint-enable`, `oxlint-disable`/`oxlint-enable`, `biome-ignore`/`biome-ignore-all`/`biome-ignore-start`/`biome-ignore-end`, `@ts-ignore`, `@ts-nocheck` comments
- ✅ **Allows removal**: Permits removing existing suppression comments
- 📝 **Smart parsing**: Uses TypeScript scanner to accurately detect comments (not string literals)
- 🔧 **Multi-tool support**: Works with Claude, OpenCode, and can be adapted for other agents
- 🧪 **Well-tested**: Comprehensive test suite included

## Quick Install

Send this prompt to your AI agent (Claude, OpenCode, etc.):

```
Install you-lint-not-pass from https://github.com/wKich/you-lint-not-pass into this project. Follow the Integration Guide in its README.
```

The agent will read this README and perform all steps automatically.

## Integration Guide (for AI Agents and Humans)

### Step 1: Install

Add as a git submodule and install its dependencies:

```bash
cd <target-project>
git submodule add https://github.com/wKich/you-lint-not-pass.git .hooks/you-lint-not-pass
cd .hooks/you-lint-not-pass && npm install && cd -
```

The `typescript` package is required at runtime — it provides the scanner that accurately distinguishes comments from string literals.

### Step 2: Register the hook — Claude Code

Read the target project's `.claude/settings.json`. If it exists, **merge** the hook entry into the existing `hooks.PreToolUse` array. If not, create it from the template.

**Hook entry to add to `hooks.PreToolUse`:**

```json
{
  "matcher": "Write|Edit|MultiEdit",
  "hooks": [
    {
      "type": "command",
      "command": "node .hooks/you-lint-not-pass/claude/pre-tool-use.mjs",
      "timeout": 200,
      "statusMessage": "Lint policy check..."
    }
  ]
}
```

**If `.claude/settings.json` does not exist**, copy the template:

```bash
cp .hooks/you-lint-not-pass/.claude/settings.json.example .claude/settings.json
```

**If it exists**, read it and append the hook entry above to the `hooks.PreToolUse` array. Do not overwrite existing hooks.

### Step 3: Register the plugin — OpenCode

Read `.opencode/config.json`. If it exists, **add** the plugin path to the existing `plugins` array. If not, copy the template.

**Plugin path to add to `plugins` array:**

```
.hooks/you-lint-not-pass/opencode/you-lint-not-pass-plugin.ts
```

> The plugin must be referenced from the submodule path (not copied), because it uses a relative import to `../src/enforce-write-policy.mjs`.

**If `.opencode/config.json` does not exist**, copy the template:

```bash
cp .hooks/you-lint-not-pass/.opencode/config.example.json .opencode/config.json
```

**If it exists**, read it and append the plugin path above to the `plugins` array. Do not remove existing plugins.

### Step 4: Verify

Ask your AI agent to add a suppression comment (e.g., `// @ts-ignore`) to any file. The hook should block the edit and explain why.

## Template Files

| Template | Purpose | Target |
|----------|---------|--------|
| `.claude/settings.json.example` | Claude Code hook config | `.claude/settings.json` |
| `opencode/you-lint-not-pass-plugin.ts` | OpenCode plugin | Referenced from submodule (not copied) |
| `.opencode/config.example.json` | OpenCode plugin config | `.opencode/config.json` |

## Configuration

Use the setter functions to customize which config files are protected and which suppression patterns are blocked:

```typescript
// .hooks/you-lint-not-pass.config.mjs
import { setProtectedLintConfig } from '../.hooks/you-lint-not-pass/src/enforce-write-policy.mjs'

setProtectedLintConfig(new Set(['.eslintrc.json', 'eslint.config.js']))
```

### Default Protected Files

**OxLint:**
- `.oxlintrc.json`
- `.oxlintrc.jsonc`
- `oxlint.config.ts`

**ESLint (legacy/eslintrc):**
- `.eslintrc.js`
- `.eslintrc.cjs`
- `.eslintrc.yaml`
- `.eslintrc.yml`
- `.eslintrc.json`
- `.eslintrc`

**ESLint (flat config):**
- `eslint.config.js`
- `eslint.config.mjs`
- `eslint.config.cjs`
- `eslint.config.ts`

**Biome:**
- `biome.json`
- `biome.jsonc`
- `.biome.json`
- `.biome.jsonc`

### Default Blocked Patterns

- `eslint-disable` / `eslint-disable-next-line` / `eslint-disable-line`
- `eslint-enable` / `eslint-enable-next-line` / `eslint-enable-line`
- `oxlint-disable` / `oxlint-disable-next-line` / `oxlint-disable-line`
- `oxlint-enable` / `oxlint-enable-next-line` / `oxlint-enable-line`
- `biome-ignore` / `biome-ignore-all` / `biome-ignore-start` / `biome-ignore-end`
- `@ts-ignore`
- `@ts-nocheck`

### Advanced Customization

Extend the default set with additional config files:

```typescript
// .hooks/you-lint-not-pass.config.mjs
import {
  PROTECTED_LINT_CONFIGS,
  setProtectedLintConfig,
} from '../.hooks/you-lint-not-pass/src/enforce-write-policy.mjs'

setProtectedLintConfig(new Set([...PROTECTED_LINT_CONFIGS, '.custom-lintrc.json']))
```

Override the suppression matchers:

```typescript
// .hooks/you-lint-not-pass.config.mjs
import { setSuppressionMatchers } from '../.hooks/you-lint-not-pass/src/enforce-write-policy.mjs'

setSuppressionMatchers([
  { label: 'eslint-disable', pattern: /\beslint-disable(?:-next-line|-line)?\b/u },
])
```

## Oxlint Plugin

This project includes a custom oxlint plugin at `lint-plugins/you-lint-not-pass-policy.js` that enforces the same suppression-comment policy at lint time:

```
you-lint-not-pass-policy/no-inline-suppression-comments
```

Reference it in your `.oxlintrc.json`:

```json
{
  "jsPlugins": ["./lint-plugins/you-lint-not-pass-policy.js"],
  "rules": {
    "you-lint-not-pass-policy/no-inline-suppression-comments": "error"
  }
}
```

## API

### `enforceWritePolicy(ctx)`

Main entry point for checking write operations.

**Parameters:**
- `ctx.tool_name`: The tool being used (`'write'`, `'edit'`, `'multiedit'`)
- `ctx.tool_input`: Object containing `file_path` and content/edit details
- `ctx.cwd`: Current working directory (project root)

**Returns:**
- `null` if allowed
- `{ decision: 'block', reason: string }` if blocked

## Development

### Prerequisites

- [Bun](https://bun.sh/) — required to run the test suite and lint

### Setup

```bash
bun install
```

### Test

```bash
bun test
```

### Lint

```bash
bun run lint
```

## License

MIT
