const eslintDisableDirective = ['eslint', 'disable'].join('-')
const eslintEnableDirective = ['eslint', 'enable'].join('-')
const oxlintDisableDirective = ['oxlint', 'disable'].join('-')
const oxlintEnableDirective = ['oxlint', 'enable'].join('-')
const biomeIgnoreDirective = 'biome-ignore'
const tsIgnoreDirective = ['@ts', 'ignore'].join('-')
const tsNoCheckDirective = ['@ts', 'nocheck'].join('-')

const suppressionMatchers = [
  {
    label: eslintDisableDirective,
    pattern: new RegExp(`\\b${eslintDisableDirective}(?:-next-line|-line)?\\b`, 'u'),
  },
  {
    label: eslintEnableDirective,
    pattern: new RegExp(`\\b${eslintEnableDirective}(?:-next-line|-line)?\\b`, 'u'),
  },
  {
    label: oxlintDisableDirective,
    pattern: new RegExp(`\\b${oxlintDisableDirective}(?:-next-line|-line)?\\b`, 'u'),
  },
  {
    label: oxlintEnableDirective,
    pattern: new RegExp(`\\b${oxlintEnableDirective}(?:-next-line|-line)?\\b`, 'u'),
  },
  {
    label: biomeIgnoreDirective,
    pattern: new RegExp(`\\b${biomeIgnoreDirective}(?:-all|-start|-end)?\\b`, 'u'),
  },
  {
    label: tsIgnoreDirective,
    pattern: new RegExp(`${tsIgnoreDirective}\\b`, 'u'),
  },
  {
    label: tsNoCheckDirective,
    pattern: new RegExp(`${tsNoCheckDirective}\\b`, 'u'),
  },
]

function report(context, nodeOrLoc, message) {
  if ('type' in nodeOrLoc) {
    context.report({ node: nodeOrLoc, message })
    return
  }

  context.report({ loc: nodeOrLoc, message })
}

const noInlineSuppressionComments = {
  meta: {
    type: 'problem',
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          for (const matcher of suppressionMatchers) {
            if (matcher.pattern.test(comment.value)) {
              report(
                context,
                comment.loc,
                `Avoid inline suppression comments (${matcher.label}); fix the underlying issue instead.`,
              )
              break
            }
          }
        }
      },
    }
  },
}

export default {
  meta: {
    name: 'you-lint-not-pass-policy',
  },
  rules: {
    'no-inline-suppression-comments': noInlineSuppressionComments,
  },
}
