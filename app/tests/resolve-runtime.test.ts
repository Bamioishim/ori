import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { lookupHandle, directoryFromEnv } from '../api/resolve.ts'
import { adapt, nodeToRequest } from '../api/_runtime.ts'
import { HandleResolveError, resolveHandleWith, EXAMPLE_HANDLES } from '../src/handles.ts'
import { PREVIEW } from '../src/previewAddrs.ts'

test('directoryFromEnv: missing/invalid JSON → empty, never throws', () => {
  assert.deepEqual(directoryFromEnv(undefined), {})
  assert.deepEqual(directoryFromEnv('{'), {})
  assert.deepEqual(directoryFromEnv('{"@x":{"address":"HPhokKWdcGDVTwEpzyLRUEAhMbwhsXAByqcUjjZsE8DT"}}')['@x'].address, 'HPhokKWdcGDVTwEpzyLRUEAhMbwhsXAByqcUjjZsE8DT')
})

test('lookupHandle: 404 unregistered vs 200 verified; never 500 for missing env', () => {
  assert.equal(lookupHandle('@tolu', {}).status, 404)
  assert.equal(lookupHandle('@tolu', {}, 'POST').status, 405)
  assert.equal(lookupHandle('tolu', {}).status, 400)
  const ok = lookupHandle('@tolu', { '@tolu': { address: PREVIEW.sol, chain: 'solana', label: 'Tolu' } })
  assert.equal(ok.status, 200)
  if (ok.status === 200) assert.equal(ok.body.address, PREVIEW.sol)
})

test('Node adapter: relative req.url + (req,res) returns JSON 404, not Invalid URL / hang', async () => {
  const handler = (await import('../api/resolve.ts')).default
  const req = Object.assign(new EventEmitter(), {
    method: 'GET',
    url: '/api/resolve?handle=%40tolu',
    headers: { host: 'ori-preview.vercel.app', 'x-forwarded-proto': 'https' },
  })
  let status = 0, body = '', headers: Record<string, string> = {}
  const res = {
    statusCode: 0,
    setHeader(k: string, v: string) { headers[k.toLowerCase()] = v },
    end(b?: string | Buffer) { status = this.statusCode; body = b ? String(b) : '' },
  }
  await handler(req as any, res as any)
  assert.equal(status, 404)
  assert.match(headers['content-type'] || '', /json/)
  assert.match(body, /not linked to a verified Solana address/)
})

test('Node adapter: Web Request path still returns Response', async () => {
  const handler = (await import('../api/resolve.ts')).default
  const r = await handler(new Request('https://example.test/api/resolve?handle=%40nobody')) as Response
  assert.ok(r instanceof Response)
  assert.equal(r.status, 404)
})

test('nodeToRequest builds absolute URL from Node relative url', async () => {
  const req = Object.assign(new EventEmitter(), { method: 'GET', url: '/api/resolve?handle=%40ade', headers: { host: 'localhost:3000' } })
  const r = await nodeToRequest(req as any)
  assert.equal(r.url, 'http://localhost:3000/api/resolve?handle=%40ade')
})

test('resolveHandleWith: 404 → example for @tolu; unregistered for unknown; 500 → example demo not live; no ORI service N as recipient', async () => {
  const f404: typeof fetch = async () => new Response(JSON.stringify({ error: 'This handle is not linked to a verified Solana address.' }), { status: 404 })
  const tolu = await resolveHandleWith(f404, '@tolu')
  assert.equal(tolu.example, true); assert.equal(tolu.address, PREVIEW.sol)
  await assert.rejects(() => resolveHandleWith(f404, '@nobody'), (e: any) => e instanceof HandleResolveError && e.kind === 'unregistered')

  const f500: typeof fetch = async () => new Response('<html>error</html>', { status: 500 })
  const demo = await resolveHandleWith(f500, '@tolu')
  assert.equal(demo.example, true) // DEMO still allowed
  assert.notEqual(demo.address, 'ORI service 500')
  await assert.rejects(() => resolveHandleWith(f500, '@stranger'), (e: any) => {
    assert.ok(e instanceof HandleResolveError && e.kind === 'service')
    assert.doesNotMatch(e.message, /ORI service 500/)
    return true
  })
})

test('resolveHandleWith: verified 200 wins over EXAMPLE map (no fabricated live payee swap)', async () => {
  const real = 'So11111111111111111111111111111111111111112'
  const f: typeof fetch = async () => new Response(JSON.stringify({ handle: '@tolu', address: real, chain: 'solana', label: 'Tolu' }), { status: 200 })
  const r = await resolveHandleWith(f, '@tolu')
  assert.equal(r.example, false); assert.equal(r.address, real)
  assert.ok(EXAMPLE_HANDLES['@tolu'])
})

test('adapt catches handler throw → JSON 500 for Node res', async () => {
  const boom = adapt(async () => { throw new Error('boom') })
  let status = 0, body = ''
  const res = { statusCode: 0, setHeader() {}, end(b?: string | Buffer) { status = this.statusCode; body = String(b || '') } }
  const req = Object.assign(new EventEmitter(), { method: 'GET', url: '/', headers: { host: 'h' } })
  await boom(req as any, res as any)
  assert.equal(status, 500)
  assert.match(body, /temporarily unavailable/)
})
