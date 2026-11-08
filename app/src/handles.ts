import { PREVIEW } from './previewAddrs.ts'
export type HandleResolution = { handle: string; address: string; chain: 'solana'; label: string; example?: boolean }
export type HandleErrorKind = 'unregistered' | 'service' | 'invalid'
export class HandleResolveError extends Error {
  kind: HandleErrorKind
  constructor(message: string, kind: HandleErrorKind) {
    super(message)
    this.kind = kind
    this.name = 'HandleResolveError'
  }
}
export const EXAMPLE_HANDLES: Record<string, { address: string; chain: 'solana'; label: string; example: true }> = {
  '@tolu': { address: PREVIEW.sol, chain: 'solana', label: 'Tolu (example)', example: true },
  '@ade': { address: PREVIEW.sol, chain: 'solana', label: 'Ade (example)', example: true },
}

function asExample(h: string): HandleResolution | null {
  const ex = EXAMPLE_HANDLES[h]
  return ex ? { handle: h, address: ex.address, chain: ex.chain, label: ex.label, example: true } : null
}

/**
 * Resolve @handle via /api/resolve.
 * - 200 + valid address → verified (live payee)
 * - 404 → unregistered (EXAMPLE handles still resolve as demo/example only)
 * - 5xx / network → service failure (EXAMPLE may still demo; never invent a live payee)
 * Server errors are never treated as a recipient address.
 */
export async function resolveHandleWith(fetchImpl: typeof fetch, handle: string, apiPath = '/api/resolve', allowExamples = true): Promise<HandleResolution> {
  const h = handle.trim().toLowerCase()
  if (!h.startsWith('@')) throw new HandleResolveError('Use a handle such as @tolu.', 'invalid')
  const q = new URLSearchParams({ handle: h })
  let r: Response
  try {
    r = await fetchImpl(apiPath + '?' + q.toString(), { headers: { accept: 'application/json' } })
  } catch {
    const ex = allowExamples ? asExample(h) : null
    if (ex) return ex
    throw new HandleResolveError('Handle directory is temporarily unavailable. Try again shortly.', 'service')
  }
  const body = await r.json().catch(() => ({} as Record<string, unknown>))
  if (r.status === 404) {
    const ex = asExample(h)
    if (ex) return ex
    throw new HandleResolveError(
      (typeof body.error === 'string' && body.error) || 'This handle is not linked to a verified Solana address.',
      'unregistered',
    )
  }
  if (r.status >= 500 || r.status === 429) {
    const ex = asExample(h)
    if (ex) return ex
    throw new HandleResolveError('Handle directory is temporarily unavailable. Try again shortly.', 'service')
  }
  if (!r.ok) {
    const ex = asExample(h)
    if (ex) return ex
    // Never surface raw "ORI service NNN" as a recipient — classify as service/unregistered.
    const msg = typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : null
    throw new HandleResolveError(msg || 'Handle lookup failed. Try again shortly.', r.status === 404 ? 'unregistered' : 'service')
  }
  const address = typeof body.address === 'string' ? body.address : ''
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    const ex = asExample(h)
    if (ex) return ex
    throw new HandleResolveError('Handle directory returned an invalid response.', 'service')
  }
  return { handle: h, address, chain: 'solana', label: (typeof body.label === 'string' && body.label) || h, example: false }
}

export function isExampleHandle(handle: string): boolean {
  return !!EXAMPLE_HANDLES[handle.trim().toLowerCase()]
}
