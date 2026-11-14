const ONECLICK = 'https://1click.chaindefuser.com/v0'

declare const process: { env: Record<string, string | undefined> }

import { normalizeTokens, validateRoute, type CatalogToken, type QuoteReq } from './_catalog.js'

export type QuoteInput = QuoteReq
// Trusted catalog fetched server-side from 1Click (public endpoint, no key), cached 5 minutes.
let cache: { at: number; list: CatalogToken[] } | null = null
export async function catalog(): Promise<CatalogToken[]> {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.list
  const r = await fetch(ONECLICK + '/tokens', { signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error('Token list unavailable.')
  const list = normalizeTokens(await r.json())
  if (!list.length) throw new Error('Token list unavailable.')
  cache = { at: Date.now(), list }; return list
}

export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export async function validateQuoteInput(input: unknown): Promise<QuoteInput | string> {
  if (!input || typeof input !== 'object') return 'Request body must be an object.'
  let cat: CatalogToken[]; try { cat = await catalog() } catch { return 'Token list unavailable; cannot validate the route.' }
  return validateRoute(cat, input as Partial<QuoteInput>)
}

export async function oneClick(path: string, init: RequestInit = {}) {
  const jwt = process.env.ORI_1CLICK_JWT
  if (!jwt) return json({ error: 'Live settlement is not configured.' }, 503)
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  headers.set('x-api-key', jwt)
  const response = await fetch(ONECLICK + path, { ...init, headers, signal: AbortSignal.timeout(15000) })
  const body = await response.json().catch(() => ({ message: 'Invalid response from 1Click.' }))
  if (!response.ok) return json({ error: body.message || `1Click returned ${response.status}.` }, response.status >= 500 ? 502 : response.status)
  return json(body)
}
