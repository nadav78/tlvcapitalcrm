// Resolves `next` against a fixed placeholder origin and only accepts it if
// it still resolves to that same origin. A regex allowlist for "starts with
// a single /" is not enough — control characters like tab/CR/LF are stripped
// by URL parsers (WHATWG URL spec) wherever they occur in the string, so
// `/\t/evil.com` would pass a naive prefix check and still collapse to
// `//evil.com` once a browser parses the redirect target. Parsing with the
// same URL algorithm the browser uses and comparing origins closes that gap.
//
// Use this for any redirect target that originates from user input (a query
// param, a form field, etc.) — never redirect to such a value directly.
export function safeRedirectPath(next: string | null | undefined): string | null {
  if (!next) return null
  try {
    const url = new URL(next, 'http://internal.invalid')
    if (url.origin !== 'http://internal.invalid') return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}
