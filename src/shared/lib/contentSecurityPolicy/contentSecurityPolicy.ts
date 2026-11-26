const DIRECTIVE_SEPARATOR = ';'
const DIRECTIVE_JOINER = '; '
const SOURCE_SEPARATOR = /\s+/
const SOURCE_JOINER = ' '
const CSP_META_PATTERN = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/
const CSP_META_MISSING_MESSAGE = 'Content-Security-Policy meta tag not found in index.html'

export const DEV_SERVER_POLICY_ADDITIONS: Readonly<Record<string, readonly string[]>> = {
  'script-src': ["'unsafe-inline'"],
  'connect-src': ['ws:']
}

export function parseContentSecurityPolicy(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>()
  for (const rawDirective of policy.split(DIRECTIVE_SEPARATOR)) {
    const [name, ...sources] = rawDirective.trim().split(SOURCE_SEPARATOR)
    if (name) {
      directives.set(name, sources)
    }
  }
  return directives
}

export function serializeContentSecurityPolicy(directives: Map<string, string[]>): string {
  return [...directives]
    .map(([name, sources]) => [name, ...sources].join(SOURCE_JOINER))
    .join(DIRECTIVE_JOINER)
}

function relaxPolicy(policy: string): string {
  const directives = parseContentSecurityPolicy(policy)
  for (const [name, additions] of Object.entries(DEV_SERVER_POLICY_ADDITIONS)) {
    const sources = directives.get(name) ?? []
    directives.set(name, [...sources, ...additions.filter((source) => !sources.includes(source))])
  }
  return serializeContentSecurityPolicy(directives)
}

export function relaxContentSecurityPolicyForDevServer(html: string): string {
  if (!CSP_META_PATTERN.test(html)) {
    throw new Error(CSP_META_MISSING_MESSAGE)
  }
  return html.replace(
    CSP_META_PATTERN,
    (_match, prefix: string, content: string, suffix: string) =>
      `${prefix}${relaxPolicy(content)}${suffix}`
  )
}
