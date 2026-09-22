import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  enforceWritePolicy,
  parsePatchSections,
  PROTECTED_LINT_CONFIGS,
  setProtectedLintConfig,
} from '../src/enforce-write-policy.mjs'

// Build directive strings dynamically to avoid triggering the hook
const buildDirective = (parts: string[]): string => parts.join('')
const eslintDisable = buildDirective(['eslint', '-disable'])
const eslintEnable = buildDirective(['eslint', '-enable'])
const oxlintDisable = buildDirective(['oxlint', '-disable'])
const oxlintEnable = buildDirective(['oxlint', '-enable'])
const biomeIgnore = 'biome-ignore'
const tsIgnore = buildDirective(['@ts-', 'ignore'])
const tsNocheck = buildDirective(['@ts-', 'nocheck'])

const makeLineComment = (text: string, suffix = ''): string => `// ${text}${suffix}`
const makeBlockComment = (text: string, suffix = ''): string => `/* ${text}${suffix} */`

describe('enforceWritePolicy', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enforce-write-policy-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  const createCtx = (
    overrides: Partial<{
      tool_name: string
      tool_input: Record<string, unknown>
    }> = {},
  ): {
    tool_name: string
    tool_input: Record<string, unknown> & { file_path: string }
    cwd: string
  } => ({
    tool_name: 'write',
    tool_input: {
      file_path: 'src/example.ts',
      content: 'export const answer = 42\n',
      ...overrides.tool_input,
    },
    cwd: tempDir,
    ...('tool_name' in overrides ? { tool_name: overrides.tool_name } : {}),
  })

  describe('protected lint config protection', () => {
    const protectedConfigs = [
      '.oxlintrc.json',
      '.oxlintrc.jsonc',
      'oxlint.config.ts',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.yaml',
      '.eslintrc.yml',
      '.eslintrc.json',
      '.eslintrc',
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      'eslint.config.ts',
      'biome.json',
      'biome.jsonc',
      '.biome.json',
      '.biome.jsonc',
    ]

    for (const configName of protectedConfigs) {
      test(`blocks edits to ${configName}`, () => {
        const result = enforceWritePolicy(
          createCtx({
            tool_input: {
              file_path: `./${configName}`,
              content: '{}\n',
            },
          }),
        )

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain(configName)
      })
    }

    test('allows editing other json files', () => {
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: './package.json',
            content: '{}\n',
          },
        }),
      )

      expect(result).toBeNull()
    })
  })

  describe('suppression comment blocking', () => {
    test('blocks write content that adds an eslint disable comment', () => {
      const directive = makeLineComment(eslintDisable, '-next-line no-console')
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\nconsole.log(answer)\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(eslintDisable)
    })

    test('blocks write content that adds an oxlint disable comment', () => {
      const directive = makeLineComment(oxlintDisable, '-next-line no-console')
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\nconsole.log(answer)\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(oxlintDisable)
    })

    test('blocks write content that adds an eslint enable comment', () => {
      const directive = makeLineComment(eslintEnable, '-next-line no-console')
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\nconsole.log(answer)\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(eslintEnable)
    })

    test('blocks write content that adds an oxlint enable comment', () => {
      const directive = makeLineComment(oxlintEnable, '-next-line no-console')
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\nconsole.log(answer)\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(oxlintEnable)
    })

    test('blocks write content that adds a biome-ignore comment', () => {
      const directive = makeLineComment(biomeIgnore, ' lint/suspicious/noDebugger')
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\ndebugger\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(biomeIgnore)
    })

    test('blocks write content that adds a biome-ignore-all comment', () => {
      const directive = makeLineComment('biome-ignore-all', ' lint')
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\nexport const x = 1\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(biomeIgnore)
    })

    test('blocks write content that adds a biome-ignore-start comment', () => {
      const directive = makeLineComment('biome-ignore-start', ' lint')
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\nexport const x = 1\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(biomeIgnore)
    })

    test('blocks write content that adds a biome-ignore-end comment', () => {
      const directive = makeLineComment('biome-ignore-end', ' lint')
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\nexport const x = 1\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(biomeIgnore)
    })

    test('blocks write content that adds ts-ignore comment', () => {
      const directive = makeLineComment(tsIgnore)
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\ncallThing()\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(tsIgnore)
    })

    test('blocks write content that adds ts-nocheck comment', () => {
      const directive = makeLineComment(tsNocheck)
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\nexport const x = 1\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(tsNocheck)
    })

    test('infers write payloads when tool_name is omitted', () => {
      const directive = makeLineComment(eslintDisable, '-next-line no-console')
      const result = enforceWritePolicy({
        cwd: tempDir,
        tool_input: {
          file_path: 'src/example.ts',
          content: `${directive}\nconsole.log(answer)\n`,
        },
      })

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(eslintDisable)
    })

    test('allows content without suppression comments', () => {
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `export const answer = 42\nconsole.log(answer)\n`,
          },
        }),
      )

      expect(result).toBeNull()
    })
  })

  describe('edit tool blocking', () => {
    test('blocks edit payloads that add a type suppression comment', () => {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
      fs.writeFileSync(path.join(tempDir, 'src', 'example.ts'), 'callThing()\n')

      const directive = makeLineComment(tsIgnore)
      const result = enforceWritePolicy(
        createCtx({
          tool_name: 'edit',
          tool_input: {
            file_path: 'src/example.ts',
            oldString: 'callThing()',
            newString: `${directive}\ncallThing()`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(tsIgnore)
    })

    test('supports snake_case edit fields from Claude-style payloads', () => {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
      fs.writeFileSync(path.join(tempDir, 'src', 'example.ts'), 'callThing()\n')

      const directive = makeLineComment(tsIgnore)
      const result = enforceWritePolicy({
        cwd: tempDir,
        tool_input: {
          file_path: 'src/example.ts',
          old_string: 'callThing()',
          new_string: `${directive}\ncallThing()`,
        },
      })

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(tsIgnore)
    })

    test('allows edits that remove an existing suppression comment', () => {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
      const directive = makeLineComment(tsIgnore)
      fs.writeFileSync(path.join(tempDir, 'src', 'example.ts'), `${directive}\ncallThing()\n`)

      const result = enforceWritePolicy(
        createCtx({
          tool_name: 'edit',
          tool_input: {
            file_path: 'src/example.ts',
            oldString: `${directive}\ncallThing()`,
            newString: 'callThing()',
          },
        }),
      )

      expect(result).toBeNull()
    })

    test('blocks multiedit payloads that add an inline suppression comment', () => {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
      fs.writeFileSync(path.join(tempDir, 'src', 'example.ts'), 'console.log(value)\n')

      const directive = makeBlockComment(oxlintDisable, ' no-console')
      const result = enforceWritePolicy(
        createCtx({
          tool_name: 'multiedit',
          tool_input: {
            file_path: 'src/example.ts',
            edits: [
              {
                oldString: 'console.log(value)',
                newString: `${directive}\nconsole.log(value)`,
              },
            ],
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(oxlintDisable)
    })

    test('falls back to scanning the payload when the edit cannot be reconstructed', () => {
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
      fs.writeFileSync(path.join(tempDir, 'src', 'example.ts'), 'callThing()\n')

      const directive = makeLineComment(tsIgnore)
      const result = enforceWritePolicy(
        createCtx({
          tool_name: 'edit',
          tool_input: {
            file_path: 'src/example.ts',
            oldString: 'missingCall()',
            newString: `${directive}\ncallThing()`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(tsIgnore)
    })
  })

  describe('smart parsing', () => {
    test('ignores matching text inside string literals', () => {
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `const label = '${eslintDisable}'\n`,
          },
        }),
      )

      expect(result).toBeNull()
    })

    test('ignores matching text inside template literals', () => {
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `const msg = \`${tsIgnore}\`\n`,
          },
        }),
      )

      expect(result).toBeNull()
    })

    test('skips non-code files even if they mention a directive name', () => {
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'docs/example.md',
            content: `${eslintDisable}\n`,
          },
        }),
      )

      expect(result).toBeNull()
    })
  })

  describe('edge cases', () => {
    test('handles new file creation with suppression comment', () => {
      const directive = makeLineComment(tsNocheck)
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/new-file.ts',
            content: `${directive}\nexport const x = 1\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
    })

    test('handles block comments with suppression', () => {
      const directive = `/* ${eslintDisable} no-console */`
      const result = enforceWritePolicy(
        createCtx({
          tool_input: {
            file_path: 'src/example.ts',
            content: `${directive}\nconsole.log('test')\n`,
          },
        }),
      )

      expect(result?.decision).toBe('block')
      expect(result?.reason).toContain(eslintDisable)
    })
  })

  describe('patch tool blocking', () => {
    const buildPatch = (bodyLines: string[]): string =>
      ['*** Begin Patch', ...bodyLines, '*** End Patch'].join('\n')

    const patchCtx = (
      patchText: string,
      toolName?: string,
    ): {
      cwd: string
      tool_input: Record<string, unknown>
      tool_name?: string
    } => ({
      cwd: tempDir,
      tool_input: { patchText },
      ...(toolName === undefined ? {} : { tool_name: toolName }),
    })

    describe('payload parsing', () => {
      test('extracts sections, paths, and added lines from a sample patch', () => {
        const sections = parsePatchSections(
          buildPatch([
            '*** Add File: src/new.ts',
            '+export const x = 1',
            '*** Update File: src/old.ts',
            '@@',
            '-console.log(a)',
            '+console.log(b)',
            ' unchanged()',
            '*** Delete File: src/gone.ts',
          ]),
        )

        expect(sections).toHaveLength(3)
        expect(sections[0]).toEqual({
          type: 'Add',
          path: 'src/new.ts',
          movePath: null,
          addedLines: ['+export const x = 1'],
        })
        expect(sections[1]).toEqual({
          type: 'Update',
          path: 'src/old.ts',
          movePath: null,
          addedLines: ['+console.log(b)'],
        })
        expect(sections[2]).toEqual({
          type: 'Delete',
          path: 'src/gone.ts',
          movePath: null,
          addedLines: [],
        })
      })

      test('extracts a Move to destination from update sections', () => {
        const sections = parsePatchSections(
          buildPatch(['*** Update File: src/a.ts', '*** Move to: src/b.ts', '+line']),
        )

        expect(sections).toHaveLength(1)
        expect(sections[0]?.movePath).toBe('src/b.ts')
      })

      test('infers patch payloads when tool_name is omitted', () => {
        const directive = makeLineComment(tsIgnore)
        const result = enforceWritePolicy(
          patchCtx(buildPatch(['*** Add File: src/example.ts', `+${directive}`])),
        )

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain(tsIgnore)
      })

      test('routes the apply_patch tool name like patch', () => {
        const directive = makeLineComment(tsIgnore)
        const result = enforceWritePolicy(
          patchCtx(
            buildPatch(['*** Add File: src/example.ts', `+${directive}`]),
            'apply_patch',
          ),
        )

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain(tsIgnore)
      })
    })

    describe('protected config protection', () => {
      test('blocks deleting a protected config via patch', () => {
        const result = enforceWritePolicy(
          patchCtx(buildPatch(['*** Delete File: .oxlintrc.json']), 'patch'),
        )

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain('.oxlintrc.json')
      })

      test('blocks adding a protected config via patch', () => {
        const result = enforceWritePolicy(
          patchCtx(buildPatch(['*** Add File: eslint.config.js', '+module.exports = {}']), 'patch'),
        )

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain('eslint.config.js')
      })

      test('blocks moving a file onto a protected config path', () => {
        const result = enforceWritePolicy(
          patchCtx(
            buildPatch(['*** Update File: src/a.ts', '*** Move to: biome.json', '+line']),
            'patch',
          ),
        )

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain('biome.json')
      })

      test('blocks renaming a protected config away', () => {
        const result = enforceWritePolicy(
          patchCtx(
            buildPatch(['*** Update File: .eslintrc.json', '*** Move to: src/renamed.ts', '+line']),
            'patch',
          ),
        )

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain('.eslintrc.json')
      })

      test('allows patches that do not touch protected configs', () => {
        const result = enforceWritePolicy(
          patchCtx(buildPatch(['*** Add File: docs/example.md', '+Some notes']), 'patch'),
        )

        expect(result).toBeNull()
      })
    })

    describe('suppression scanning of added lines', () => {
      test('blocks a patch whose added line contains a suppression marker', () => {
        const directive = makeLineComment(eslintDisable, '-next-line no-console')
        const result = enforceWritePolicy(
          patchCtx(buildPatch(['*** Add File: src/a.ts', `+${directive}`]), 'patch'),
        )

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain('src/a.ts')
        expect(result?.reason).toContain(eslintDisable)
      })

      test('names every offending file in one denial', () => {
        const directive = makeLineComment(tsIgnore)
        const result = enforceWritePolicy(
          patchCtx(
            buildPatch([
              '*** Add File: src/one.ts',
              `+${directive}`,
              '*** Add File: src/two.ts',
              `+${directive}`,
            ]),
            'patch',
          ),
        )

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain('src/one.ts')
        expect(result?.reason).toContain('src/two.ts')
      })

      test('does not flag markers on context or removal lines', () => {
        const directive = makeLineComment(tsIgnore)
        const result = enforceWritePolicy(
          patchCtx(
            buildPatch([
              '*** Update File: src/a.ts',
              '@@',
              `-${directive}`,
              `${directive}`,
              '+export const x = 1',
            ]),
            'patch',
          ),
        )

        expect(result).toBeNull()
      })

      test('allows a clean patch', () => {
        const result = enforceWritePolicy(
          patchCtx(
            buildPatch([
              '*** Update File: src/a.ts',
              '@@',
              '-old()',
              '+new()',
              '*** Add File: src/b.ts',
              '+export const b = 2',
            ]),
            'patch',
          ),
        )

        expect(result).toBeNull()
      })
    })

    describe('fail-closed handling', () => {
      test('blocks a patch payload without recognizable file sections', () => {
        const result = enforceWritePolicy(patchCtx('no markers, no headers\n+whatever', 'patch'))

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain('could not be verified')
      })

      test('blocks envelope markers containing no file sections', () => {
        const result = enforceWritePolicy(patchCtx(buildPatch([]), 'patch'))

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain('could not be verified')
      })

      test('blocks a patch tool call with a missing payload', () => {
        const result = enforceWritePolicy({
          cwd: tempDir,
          tool_name: 'patch',
          tool_input: {},
        })

        expect(result?.decision).toBe('block')
        expect(result?.reason).toContain('could not be verified')
      })
    })
  })

  describe('setProtectedLintConfig', () => {
    const original = PROTECTED_LINT_CONFIGS

    afterEach(() => {
      setProtectedLintConfig(original)
    })

    test('overriding with a custom Set protects only those files', () => {
      setProtectedLintConfig(new Set(['.eslintrc.json']))

      expect(
        enforceWritePolicy(
          createCtx({ tool_input: { file_path: './.eslintrc.json', content: '{}' } }),
        )?.decision,
      ).toBe('block')

      expect(
        enforceWritePolicy(
          createCtx({ tool_input: { file_path: './.oxlintrc.json', content: '{}' } }),
        ),
      ).toBeNull()
    })

    test('overriding with a string protects only that file', () => {
      setProtectedLintConfig('.biome.jsonc')

      expect(
        enforceWritePolicy(
          createCtx({ tool_input: { file_path: './.biome.jsonc', content: '{}' } }),
        )?.decision,
      ).toBe('block')

      expect(
        enforceWritePolicy(
          createCtx({ tool_input: { file_path: './biome.json', content: '{}' } }),
        ),
      ).toBeNull()
    })
  })
})
