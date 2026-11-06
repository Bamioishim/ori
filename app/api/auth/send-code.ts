import nodemailer from 'nodemailer'
import { sendCode } from './_codes.js'
import { getAuthStore } from './_store.js'
import { adapt } from '../_runtime.js'

declare const process: { env: Record<string, string | undefined> }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

async function webHandler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const body = await req.json().catch(() => ({})) as { email?: string; purpose?: string }
  const env = process.env, user = env.GMAIL_OAUTH_USER, from = env.GMAIL_OAUTH_FROM || user
  const mailReady = user && env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.GMAIL_OAUTH_REFRESH_TOKEN && from
  const send = mailReady ? async (to: string, code: string) => {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { type: 'OAuth2', user, clientId: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET, refreshToken: env.GMAIL_OAUTH_REFRESH_TOKEN } })
    await t.sendMail({ from, to, subject: 'Your ORI code', text: `Your ORI code is ${code}. It expires in 10 minutes and works once. If you did not request this, ignore this email.` })
  } : undefined
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  const r = await sendCode(String(body.email || ''), ip, String(body.purpose || 'login'), { store: getAuthStore(), secret: env.ORI_AUTH_CODE_SECRET, send })
  return json(r.body, r.status)
}

export default adapt(webHandler)
