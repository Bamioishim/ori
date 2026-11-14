import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { exactBodyBytes, nodeToRequest, adapt } from '../api/_runtime.ts'
import { STORE_MISSING } from '../api/auth/_store.ts'

function nodeReq(o: { method?: string; url?: string; chunks?: Buffer[]; headers?: Record<string, string> }) {
  const req = Object.assign(new EventEmitter(), {
    method: o.method || 'POST',
    url: o.url || '/api/x',
    headers: { host: 'ori.test', 'content-type': 'application/json', ...(o.headers || {}) },
  })
  queueMicrotask(() => {
    for (const c of o.chunks || []) req.emit('data', c)
    req.emit('end')
  })
  return req
}

function nodeRes() {
  let status = 0, body = '', headers: Record<string, string> = {}
  return {
    get status() { return status },
    get body() { return body },
    get headers() { return headers },
    statusCode: 0,
    setHeader(k: string, v: string) { headers[k.toLowerCase()] = v },
    end(b?: string | Buffer) { status = this.statusCode; body = b ? String(b) : '' },
  }
}

test('exactBodyBytes: pooled Buffer view must not leak surrounding pool data', () => {
  const pool = Buffer.allocUnsafe(64253)
  pool.fill(0xEE)
  const payload = Buffer.from('{"a":1}', 'utf8')
  payload.copy(pool, 0)
  // Classic leak: .buffer of a small slice is the whole pool
  const sliced = pool.subarray(0, payload.length)
  assert.ok(sliced.buffer.byteLength > payload.length, 'precondition: pooled backing store is larger')
  const exact = exactBodyBytes([sliced])!
  assert.equal(exact.byteLength, payload.length)
  assert.equal(Buffer.from(exact).toString('utf8'), '{"a":1}')
  assert.equal(Buffer.from(exact).includes(0xEE), false)
})

test('exactBodyBytes: multichunk concat is byte-exact (no prefix/trailing pool)', () => {
  const a = Buffer.from('{"email":"')
  const b = Buffer.from('user@gmail.com","purpose":"login"}')
  const exact = exactBodyBytes([a, b])!
  const text = Buffer.from(exact).toString('utf8')
  assert.equal(text, '{"email":"user@gmail.com","purpose":"login"}')
  assert.equal(exact.byteLength, Buffer.byteLength(text))
  assert.deepEqual(JSON.parse(text), { email: 'user@gmail.com', purpose: 'login' })
})

test('exactBodyBytes: empty → undefined', () => {
  assert.equal(exactBodyBytes([]), undefined)
  assert.equal(exactBodyBytes([Buffer.alloc(0)]), undefined)
})

test('nodeToRequest POST: small JSON body roundtrip parses (pooled chunk)', async () => {
  const json = '{"email":"a@gmail.com","purpose":"login"}'
  const pool = Buffer.allocUnsafe(4096)
  pool.fill(0xAB)
  Buffer.from(json).copy(pool, 0)
  const chunk = pool.subarray(0, Buffer.byteLength(json))
  const req = nodeReq({ url: '/api/auth/send-code', chunks: [chunk] })
  const request = await nodeToRequest(req as any)
  assert.equal(await request.text(), json)
  // Re-build for json() (body consumed)
  const req2 = nodeReq({ url: '/api/auth/send-code', chunks: [chunk] })
  const request2 = await nodeToRequest(req2 as any)
  assert.deepEqual(await request2.json(), { email: 'a@gmail.com', purpose: 'login' })
})

test('nodeToRequest POST: multichunk body exact', async () => {
  const parts = [Buffer.from('{"x":'), Buffer.from('1'), Buffer.from('}')]
  const req = nodeReq({ chunks: parts })
  const request = await nodeToRequest(req as any)
  assert.equal(await request.text(), '{"x":1}')
})

test('Node POST auth/send-code: valid JSON reaches fail-closed store gate (no mail)', async () => {
  const handler = (await import('../api/auth/send-code.ts')).default
  const json = '{"email":"demo@gmail.com","purpose":"login"}'
  const pool = Buffer.allocUnsafe(8192)
  pool.fill(0xCD)
  Buffer.from(json).copy(pool, 0)
  const req = nodeReq({ url: '/api/auth/send-code', chunks: [pool.subarray(0, Buffer.byteLength(json))] })
  const res = nodeRes()
  await handler(req as any, res as any)
  assert.equal(res.status, 503)
  const body = JSON.parse(res.body)
  assert.equal(body.error, STORE_MISSING)
})

test('Node POST quote: invalid JSON → 400 without provider binding; GET → 405', async () => {
  const handler = (await import('../api/quote.ts')).default
  const bad = nodeReq({ url: '/api/quote', chunks: [Buffer.from('not-json{')] })
  const res = nodeRes()
  await handler(bad as any, res as any)
  assert.equal(res.status, 400)
  assert.match(res.body, /Invalid JSON/)

  const getReq = Object.assign(new EventEmitter(), { method: 'GET', url: '/api/quote', headers: { host: 'ori.test' } })
  queueMicrotask(() => getReq.emit('end'))
  const res2 = nodeRes()
  await handler(getReq as any, res2 as any)
  assert.equal(res2.status, 405)
})

test('adapt echo: Request body byteLength matches payload (regression for 75→64253 leak)', async () => {
  const payload = Buffer.from('{"ok":true}')
  const pool = Buffer.allocUnsafe(64253)
  pool.fill(0x11)
  payload.copy(pool, 0)
  let seen = 0
  const handler = adapt(async (request) => {
    const ab = await request.arrayBuffer()
    seen = ab.byteLength
    assert.equal(Buffer.from(ab).toString('utf8'), '{"ok":true}')
    return new Response(JSON.stringify({ n: ab.byteLength }), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  const req = nodeReq({ chunks: [pool.subarray(0, payload.length)] })
  const res = nodeRes()
  await handler(req as any, res as any)
  assert.equal(seen, payload.length)
  assert.equal(JSON.parse(res.body).n, payload.length)
})
