import { Plugin } from '@opencode/plugin'

import { enforceWritePolicy } from '../src/enforce-write-policy.mjs'

const EDIT_TOOLS = new Set(['write', 'edit', 'patch', 'apply_patch'])

export const YouLintNotPassPlugin = Plugin.define({
  id: 'you-lint-not-pass',
  async setup(ctx) {
    await ctx.tool.hook('execute.before', (event) => {
      if (!EDIT_TOOLS.has(event.tool)) return

      const toolArgs = event.input as Record<string, unknown>
      const filePath = typeof toolArgs['path'] === 'string' ? toolArgs['path'] : undefined

      const result = enforceWritePolicy({
        tool_name: event.tool,
        tool_input: {
          ...toolArgs,
          ...(filePath === undefined ? {} : { file_path: filePath }),
        },
        cwd: ctx.location.directory,
      })

      if (result) {
        throw new Error(result.reason)
      }
    })
  },
})

export default YouLintNotPassPlugin
