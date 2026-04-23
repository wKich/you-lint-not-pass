// Claude Code PreToolUse hook for lint policy enforcement
// Place this in your .claude/hooks/ directory and reference from settings.json

import fs from 'node:fs'

import { enforceWritePolicy } from '../src/enforce-write-policy.mjs'

try {
  const ctx = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'))

  const result = enforceWritePolicy(ctx)
  if (result) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: result.reason,
        },
      }),
    )
    process.exit(0)
  }
} catch (err) {
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'Lint hook execution failed',
      error: err instanceof Error ? err.message : String(err),
    }),
  )
}

process.exit(0)
