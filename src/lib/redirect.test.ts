import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from './redirect'

describe('safeRedirectPath', () => {
  it('accepts a plain same-origin path', () => {
    expect(safeRedirectPath('/opportunities')).toBe('/opportunities')
  })

  it('preserves query string and hash', () => {
    expect(safeRedirectPath('/opportunities?stage=won#top')).toBe('/opportunities?stage=won#top')
  })

  it('rejects null, undefined, and empty string', () => {
    expect(safeRedirectPath(null)).toBeNull()
    expect(safeRedirectPath(undefined)).toBeNull()
    expect(safeRedirectPath('')).toBeNull()
  })

  it('rejects a protocol-relative bypass', () => {
    expect(safeRedirectPath('//evil.com')).toBeNull()
  })

  it('rejects a backslash bypass', () => {
    expect(safeRedirectPath('/\\evil.com')).toBeNull()
  })

  it('rejects a control-character bypass that collapses to protocol-relative', () => {
    expect(safeRedirectPath('/\t/evil.com')).toBeNull()
    expect(safeRedirectPath('/\r/evil.com')).toBeNull()
    expect(safeRedirectPath('/\n/evil.com')).toBeNull()
  })

  it('rejects a fully-qualified external URL', () => {
    expect(safeRedirectPath('https://evil.com')).toBeNull()
  })
})
