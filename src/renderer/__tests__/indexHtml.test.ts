// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseContentSecurityPolicy } from '@lib/contentSecurityPolicy'

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8')
const CSP_CONTENT_PATTERN = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/

describe('renderer index.html', () => {
  it('declares the strict production Content-Security-Policy', () => {
    const content = CSP_CONTENT_PATTERN.exec(html)?.[1]
    expect(content).toBeDefined()
    const directives = parseContentSecurityPolicy(content ?? '')
    expect(Object.fromEntries(directives)).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    })
  })

  it('references no remote origin', () => {
    expect(html).not.toMatch(/https?:\/\//)
  })
})
