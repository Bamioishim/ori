import { sendCode } from './_codes.js'
import { getAuthStore } from './_store.js'
import { mailerFromEnv } from './_mail.js'
import { adapt } from '../_runtime.js'

declare const process: { env: Record<string, string | undefined> }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

async function webHandler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const body = await req.json().catch(() => ({})) as { email?: string; purpose?: string }
  const env = process.env
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const r = await sendCode(String(body.email || ''), ip, String(body.purpose || 'login'), { store: getAuthStore(), secret: env.ORI_AUTH_CODE_SECRET, send: mailerFromEnv(env) })
  return json(r.body, r.status)
}

export default adapt(webHandler)
