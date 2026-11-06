// Minimal Node ↔ Web Request/Response adapter for Vercel.
// Handlers are written as (Request) => Response; the deployed Node runtime calls (req, res).
// Scope: shared wrapper for compatible JSON endpoints (resolve / quote / status / auth).

type WebHandler = (request: Request) => Response | Promise<Response>

function headersFromNode(h: Record<string, unknown> | undefined): Headers {
  const out = new Headers()
  if (!h) return out
  for (const [k, v] of Object.entries(h)) {
    if (v == null) continue
    if (Array.isArray(v)) v.forEach(x => out.append(k, String(x)))
    else out.set(k, String(v))
  }
  return out
}

function readNodeBody(req: { on: Function; headers?: Record<string, unknown> }): Promise<ArrayBuffer | undefined> {
  const method = String((req as { method?: string }).method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') return Promise.resolve(undefined)
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).buffer))
    req.on('error', reject)
  })
}

export async function nodeToRequest(req: {
  method?: string; url?: string; headers?: Record<string, unknown>; on: Function
}): Promise<Request> {
  const host = String(req.headers?.host || 'localhost')
  const proto = String(req.headers?.['x-forwarded-proto'] || 'http')
  const path = req.url || '/'
  const url = new URL(path, `${proto}://${host}`)
  const method = (req.method || 'GET').toUpperCase()
  const body = await readNodeBody(req)
  const init: RequestInit = { method, headers: headersFromNode(req.headers) }
  if (body && body.byteLength) {
    init.body = body
    ;(init as RequestInit & { duplex?: string }).duplex = 'half'
  }
  return new Request(url, init)
}

export async function sendNodeResponse(res: {
  statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string | Buffer) => void
}, response: Response) {
  res.statusCode = response.status
  response.headers.forEach((v, k) => { if (k.toLowerCase() !== 'transfer-encoding') res.setHeader(k, v) })
  const buf = Buffer.from(await response.arrayBuffer())
  res.end(buf)
}

/** Wrap a Web handler so Node (req, res) and Edge/Request both work. */
export function adapt(handler: WebHandler) {
  return async function adapted(req: any, res?: any): Promise<Response | void> {
    try {
      if (typeof Request !== 'undefined' && req instanceof Request) return await handler(req)
      if (res && typeof res.end === 'function') {
        const request = await nodeToRequest(req)
        const response = await handler(request)
        await sendNodeResponse(res, response)
        return
      }
      return await handler(req as Request)
    } catch (e) {
      const body = JSON.stringify({ error: 'ORI service temporarily unavailable.' })
      if (res && typeof res.end === 'function') {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-store')
        res.end(body)
        return
      }
      return new Response(body, { status: 500, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
    }
  }
}
