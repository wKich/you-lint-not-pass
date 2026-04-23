import type { Plugin } from '@opencode-ai/plugin'

import { enforceWritePolicy } from '../src/enforce-write-policy.mjs'

const EDIT_TOOLS = new Set(['write', 'edit', 'multiedit'])

export const YouLintNotPassPlugin: Plugin = ({ directory }) => {
  return {
    'tool.execute.before': (input, output) => {
      if (!EDIT_TOOLS.has(input.tool)) return

      const toolArgs = output.args as Record<string, unknown>
      const filePath = toolArgs['filePath'] as string
      if (!filePath) return

      const ctx = {
        tool_name: input.tool,
        tool_input: { ...toolArgs, file_path: filePath },
        cwd: directory,
      }

      const result = enforceWritePolicy(ctx)
      if (result) {
        throw new Error(result.reason)
      }
    },
  }
}

export default YouLintNotPassPlugin
