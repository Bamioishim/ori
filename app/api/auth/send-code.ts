import nodemailer from 'nodemailer'

declare const process: { env: Record<string, string | undefined> }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const bytes = (s: string) => new TextEncoder().encode(s)
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const digestHex = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(s)))).map(x => x.toString(16).padStart(2, '0')).join('')
const sign = async (s: string, key: string) => b64url(new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', bytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), bytes(s))))

export default async function handler(req: Request) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const body = await req.json().catch(() => ({})) as { email?: string }
  const email = String(body.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@gmail\.com$/.test(email)) return json({ error: 'Use the Gmail address attached to your ORI account.' }, 400)
  const key = process.env.ORI_AUTH_CODE_SECRET; const user = process.env.GMAIL_OAUTH_USER; const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID; const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET; const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN; const from = process.env.GMAIL_OAUTH_FROM || user
  if (!key || !user || !clientId || !clientSecret || !refreshToken || !from) return json({ error: 'Gmail recovery is not configured yet. Add the Google OAuth2 mail settings before requesting a code.' }, 503)
  const random = new Uint32Array(1); crypto.getRandomValues(random); const code = String(100000 + (random[0] % 900000)); const exp = Date.now() + 10 * 60 * 1000
  const payload = JSON.stringify({ email, exp, hash: await digestHex(code) }); const encoded = b64url(bytes(payload)); const sig = await sign(encoded, key)
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { type: 'OAuth2', user, clientId, clientSecret, refreshToken } })
    await transporter.sendMail({ from, to: email, subject: 'Your ORI recovery code', text: `Your ORI recovery code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.` })
  } catch { return json({ error: 'The Gmail recovery email could not be sent. Check the Google OAuth2 mail configuration.' }, 502) }
  return json({ challenge: `${encoded}.${sig}`, expiresAt: exp })
}
