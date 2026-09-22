import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import YouLintNotPassPlugin from '../opencode/you-lint-not-pass-plugin.ts'

type ExecuteBeforeEvent = { tool: string; input: unknown }
type HookCallback = (event: ExecuteBeforeEvent) => Promise<void> | void
type SetupContext = Parameters<typeof YouLintNotPassPlugin.setup>[0]

// Build directive strings dynamically to avoid triggering the hook
const buildDirective = (parts: string[]): string => parts.join('')
const tsIgnore = buildDirective(['@ts-', 'ignore'])

describe('opencode plugin hook', () => {
  let tempDir: string
  let hooks: Map<string, HookCallback>

  const executeBefore = (): HookCallback => {
    const hook = hooks.get('execute.before')
    if (hook === undefined) throw new Error('execute.before hook was not registered')
    return hook
  }

  const invoke = async (event: ExecuteBeforeEvent): Promise<void> => {
    await executeBefore()(event)
  }

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'you-lint-not-pass-plugin-'))
    hooks = new Map()

    const fakeCtx = {
      location: { directory: tempDir },
      tool: {
        hook: (name: string, callback: HookCallback): { dispose: () => Promise<void> } => {
          hooks.set(name, callback)
          return { dispose: (): Promise<void> => Promise.resolve() }
        },
      },
    }

    await YouLintNotPassPlugin.setup(fakeCtx as unknown as SetupContext)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('registers a stable plugin id', () => {
    expect(YouLintNotPassPlugin.id).toBe('you-lint-not-pass')
    expect(hooks.has('execute.before')).toBe(true)
  })

  test('blocks a write that inserts a suppression comment', async () => {
    const directive = `// ${tsIgnore}`

    await expect(
      invoke({
        tool: 'write',
        input: { path: 'src/example.ts', content: `${directive}\n` },
      }),
    ).rejects.toThrow(tsIgnore)
  })

  test('blocks an edit targeting a protected lint config', async () => {
    await expect(
      invoke({
        tool: 'edit',
        input: { path: '.oxlintrc.json', oldString: 'a', newString: 'b' },
      }),
    ).rejects.toThrow('.oxlintrc.json')
  })

  test('allows a compliant edit', async () => {
    fs.writeFileSync(path.join(tempDir, 'example.ts'), 'callThing()\n')

    await invoke({
      tool: 'edit',
      input: { path: 'example.ts', oldString: 'callThing()', newString: 'callOther()' },
    })
  })

  test('does not route non-edit tools to the policy', async () => {
    // If `read` were routed, the core would treat this payload shape as a
    // write and deny it, so reaching here proves the tool filter works.
    await invoke({
      tool: 'read',
      input: { path: '.oxlintrc.json', content: '{}' },
    })
  })

  test('blocks a patch call that adds a suppression comment', async () => {
    const directive = `// ${tsIgnore}`
    const patchText = [
      '*** Begin Patch',
      '*** Add File: src/example.ts',
      `+${directive}`,
      '*** End Patch',
    ].join('\n')

    await expect(
      invoke({ tool: 'patch', input: { patchText } }),
    ).rejects.toThrow(tsIgnore)
  })

  test('routes the apply_patch tool name like patch', async () => {
    const patchText = ['*** Begin Patch', '*** Delete File: .oxlintrc.json', '*** End Patch'].join(
      '\n',
    )

    await expect(
      invoke({ tool: 'apply_patch', input: { patchText } }),
    ).rejects.toThrow('.oxlintrc.json')
  })

  test('blocks a patch call touching a protected config', async () => {
    const patchText = [
      '*** Begin Patch',
      '*** Add File: eslint.config.js',
      '+module.exports = {}',
      '*** End Patch',
    ].join('\n')

    await expect(
      invoke({ tool: 'patch', input: { patchText } }),
    ).rejects.toThrow('eslint.config.js')
  })
})
