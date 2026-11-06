import { verifyCode } from './_codes.js'
import { getAuthStore } from './_store.js'
import { adapt } from '../_runtime.js'

declare const process: { env: Record<string, string | undefined> }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

async function webHandler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const body = await req.json().catch(() => ({})) as { challenge?: string; code?: string }
  const r = await verifyCode(String(body.challenge || ''), String(body.code || ''), { store: getAuthStore(), secret: process.env.ORI_AUTH_CODE_SECRET })
  return json(r.body, r.status)
}

export default adapt(webHandler)
