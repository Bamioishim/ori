// Login-code delivery. Resend is preferred when RESEND_API_KEY is set; otherwise Gmail SMTP XOAUTH2.
// With neither, send-code fails closed (503). Fetch is injectable so tests never hit the network.
import nodemailer from 'nodemailer'

export const DEFAULT_RESEND_FROM = 'ORI <onboarding@resend.dev>'
export const MAIL_MISSING = 'Email login is not configured yet: ORI needs a mail provider (Resend or Gmail OAuth), and none is set. You can keep using ORI as a guest.'
export const mailBody = (code: string) => `Your ORI code is ${code}. It expires in 10 minutes and works once. If you did not request this, ignore this email.`
export type SendMail = (to: string, code: string) => Promise<void>
type Fetch = (url: string, init?: RequestInit) => Promise<Response>
export type MailerKind = { kind: 'resend'; from: string } | { kind: 'gmail'; user: string; from: string }

export function selectMailer(env: Record<string, string | undefined>): MailerKind | null {
  if (env.RESEND_API_KEY) return { kind: 'resend', from: env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM }
  const user = env.GMAIL_OAUTH_USER, from = env.GMAIL_OAUTH_FROM || user
  if (user && env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.GMAIL_OAUTH_REFRESH_TOKEN && from) return { kind: 'gmail', user, from }
  return null
}

export function mailerFromEnv(env: Record<string, string | undefined>, f: Fetch = (u, i) => fetch(u, i)): SendMail | undefined {
  const sel = selectMailer(env)
  if (!sel) return undefined
  if (sel.kind === 'resend') {
    const key = env.RESEND_API_KEY as string
    return async (to, code) => {
      const r = await f('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: sel.from, to: [to], subject: 'Your ORI code', text: mailBody(code) }) })
      if (!r.ok) throw new Error(`ORI mail provider request failed (${r.status}).`)
    }
  }
  return async (to, code) => {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { type: 'OAuth2', user: sel.user, clientId: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET, refreshToken: env.GMAIL_OAUTH_REFRESH_TOKEN } })
    await t.sendMail({ from: sel.from, to, subject: 'Your ORI code', text: mailBody(code) })
  }
}
