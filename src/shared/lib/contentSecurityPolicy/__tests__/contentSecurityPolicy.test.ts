import { describe, expect, it } from 'vitest'
import {
  parseContentSecurityPolicy,
  relaxContentSecurityPolicyForDevServer,
  serializeContentSecurityPolicy
} from '../contentSecurityPolicy'

const PRODUCTION =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' data: blob:"
const html = `<head><meta http-equiv="Content-Security-Policy" content="${PRODUCTION}" /></head>`

describe('contentSecurityPolicy', () => {
  it('parses directives into name → sources', () => {
    expect(parseContentSecurityPolicy(PRODUCTION).get('img-src')).toEqual([
      "'self'",
      'data:',
      'blob:'
    ])
  })

  it('round-trips through serialize', () => {
    expect(serializeContentSecurityPolicy(parseContentSecurityPolicy(PRODUCTION))).toBe(PRODUCTION)
  })

  it('adds inline scripts and the HMR websocket for the dev server only', () => {
    const relaxed = relaxContentSecurityPolicyForDevServer(html)
    expect(relaxed).toContain("script-src 'self' 'unsafe-inline';")
    expect(relaxed).toContain("connect-src 'self' ws:;")
    expect(relaxed).toContain("default-src 'self';")
    expect(relaxed).toContain("font-src 'self';")
  })

  it('is idempotent', () => {
    const once = relaxContentSecurityPolicyForDevServer(html)
    expect(relaxContentSecurityPolicyForDevServer(once)).toBe(once)
  })

  it('throws when the meta tag is missing', () => {
    expect(() => relaxContentSecurityPolicyForDevServer('<head></head>')).toThrow(
      'Content-Security-Policy meta tag not found'
    )
  })
})
