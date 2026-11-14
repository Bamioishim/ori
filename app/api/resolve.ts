import { json } from './_oneclick.js'
import { adapt } from './_runtime.js'

declare const process: { env: Record<string, string | undefined> }

const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const HANDLE = /^@[a-z0-9][a-z0-9._-]{0,31}$/

export type Entry = { address: string; chain?: 'solana'; label?: string }

/** Parse ORI_HANDLE_DIRECTORY. Invalid JSON → empty (not 500). */
export function directoryFromEnv(raw: string | undefined): Record<string, Entry> {
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, Entry> } catch { return {} }
}

export type ResolveResult =
  | { status: 200; body: { handle: string; address: string; chain: 'solana'; label: string } }
  | { status: 400 | 404 | 405; body: { error: string } }

/** Pure lookup — no Request dependency (unit-tested). */
export function lookupHandle(handleRaw: string, dir: Record<string, Entry>, method = 'GET'): ResolveResult {
  if (method !== 'GET') return { status: 405, body: { error: 'Method not allowed.' } }
  const raw = handleRaw.trim().toLowerCase()
  if (!HANDLE.test(raw)) return { status: 400, body: { error: 'Use a handle such as @tolu.' } }
  const entry = dir[raw]
  if (!entry || (entry.chain && entry.chain !== 'solana') || !SOLANA.test(entry.address)) {
    return { status: 404, body: { error: 'This handle is not linked to a verified Solana address.' } }
  }
  return { status: 200, body: { handle: raw, address: entry.address, chain: 'solana', label: entry.label || raw } }
}

async function webHandler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const result = lookupHandle(url.searchParams.get('handle') || '', directoryFromEnv(process.env.ORI_HANDLE_DIRECTORY), request.method)
  return json(result.body, result.status)
}

export default adapt(webHandler)
