import { PREVIEW } from './previewAddrs.ts'
export type HandleResolution = { handle: string; address: string; chain: 'solana'; label: string; example?: boolean }
export const EXAMPLE_HANDLES: Record<string, { address: string; chain: 'solana'; label: string; example: true }> = {
  '@tolu': { address: PREVIEW.sol, chain: 'solana', label: 'Tolu (example)', example: true },
  '@ade': { address: PREVIEW.sol, chain: 'solana', label: 'Ade (example)', example: true },
}
export async function resolveHandleWith(fetchImpl: typeof fetch, handle: string, apiPath = '/api/resolve'): Promise<HandleResolution> {
  const h = handle.trim().toLowerCase()
  const q = new URLSearchParams({ handle: h })
  try {
    const r = await fetchImpl(apiPath + '?' + q.toString(), { headers: { 'content-type': 'application/json' } })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body.error || body.message || `ORI service ${r.status}`)
    return { handle: h, address: body.address, chain: 'solana', label: body.label || h, example: false }
  } catch (e) {
    const ex = EXAMPLE_HANDLES[h]
    if (ex) return { handle: h, address: ex.address, chain: ex.chain, label: ex.label, example: true }
    throw e
  }
}
