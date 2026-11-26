// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const srcRoot = fileURLToPath(new URL('../..', import.meta.url))
const thisFile = fileURLToPath(import.meta.url)
const mainSource = readFileSync(fileURLToPath(new URL('../main.tsx', import.meta.url)), 'utf8')

const REMOTE_FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']
const BUNDLED_STYLESHEETS = [
  { path: '@fontsource/inter/300.css', family: "'Inter'" },
  { path: '@fontsource/inter/400.css', family: "'Inter'" },
  { path: '@fontsource/inter/500.css', family: "'Inter'" },
  { path: '@fontsource/inter/600.css', family: "'Inter'" },
  { path: '@fontsource/inter/700.css', family: "'Inter'" },
  { path: '@fontsource/jetbrains-mono/400.css', family: "'JetBrains Mono'" },
  { path: '@fontsource/jetbrains-mono/500.css', family: "'JetBrains Mono'" },
  { path: '@fontsource/jetbrains-mono/600.css', family: "'JetBrains Mono'" },
  { path: 'material-icons/iconfont/round.css', family: '"Material Icons Round"' }
]

const findOffenders = (): string[] => {
  const files = readdirSync(srcRoot, { recursive: true, encoding: 'utf8' })
  return files
    .map((relative) => join(srcRoot, relative))
    .filter((absolute) => absolute !== thisFile && statSync(absolute).isFile())
    .filter((absolute) => {
      const content = readFileSync(absolute, 'utf8')
      return REMOTE_FONT_HOSTS.some((host) => content.includes(host))
    })
    .map((absolute) => absolute.slice(srcRoot.length))
}

describe('offline assets', () => {
  it('no source file under src/ references a remote font host', () => {
    expect(findOffenders()).toEqual([])
  })

  it.each(BUNDLED_STYLESHEETS)('renderer entry imports $path', ({ path }) => {
    expect(mainSource).toContain(`import '${path}'`)
  })

  it.each(BUNDLED_STYLESHEETS)(
    '$path resolves locally and declares $family',
    ({ path, family }) => {
      const css = readFileSync(require.resolve(path), 'utf8')
      expect(css).toContain(`font-family: ${family}`)
    }
  )

  it('the icon stylesheet defines the material-icons-round class used by Icon', () => {
    expect(readFileSync(require.resolve('material-icons/iconfont/round.css'), 'utf8')).toContain(
      '.material-icons-round {'
    )
  })
})
