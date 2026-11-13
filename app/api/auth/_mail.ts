// Login-code delivery. Order: Resend with a verified-domain sender (RESEND_FROM_EMAIL) > Gmail SMTP app password
// (GMAIL_SMTP_USER + GMAIL_APP_PASSWORD) > Resend sandbox sender (only reaches the Resend account owner) > Gmail SMTP XOAUTH2.
// With neither, send-code fails closed (503). Fetch is injectable so tests never hit the network.
import nodemailer from 'nodemailer'

export const DEFAULT_RESEND_FROM = 'ORI <onboarding@resend.dev>'
export const MAIL_MISSING = 'Email login is not configured yet: ORI needs a mail provider (Resend or Gmail OAuth), and none is set. You can keep using ORI as a guest.'
export const mailBody = (code: string) => `Your ORI code is ${code}. It expires in 10 minutes and works once. If you did not request this, ignore this email.`
export type SendMail = (to: string, code: string) => Promise<void>
type Fetch = (url: string, init?: RequestInit) => Promise<Response>
export type MailerKind = { kind: 'resend'; from: string } | { kind: 'gmail'; user: string; from: string } | { kind: 'gmail-app'; user: string; from: string }

export function selectMailer(env: Record<string, string | undefined>): MailerKind | null {
  const resendFrom = env.RESEND_FROM_EMAIL || DEFAULT_RESEND_FROM
  // onboarding@resend.dev is Resend's sandbox sender: it can only deliver to the Resend account owner's address.
  if (env.RESEND_API_KEY && resendFrom !== DEFAULT_RESEND_FROM) return { kind: 'resend', from: resendFrom }
  const appUser = env.GMAIL_SMTP_USER
  if (appUser && env.GMAIL_APP_PASSWORD) return { kind: 'gmail-app', user: appUser, from: env.GMAIL_SMTP_FROM || `ORI <${appUser}>` }
  if (env.RESEND_API_KEY) return { kind: 'resend', from: resendFrom }
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
      if (!r.ok) { const detail = await r.text().catch(() => ''); console.error('ORI Resend send failed', r.status, detail.slice(0, 300)); throw new Error(`ORI mail provider request failed (${r.status}).`) }
    }
  }
  if (sel.kind === 'gmail-app') {
    return async (to, code) => {
      const t = nodemailer.createTransport({ service: 'gmail', auth: { user: sel.user, pass: String(env.GMAIL_APP_PASSWORD).replace(/\s+/g, '') } })
      await t.sendMail({ from: sel.from, to, subject: 'Your ORI code', text: mailBody(code) })
    }
  }
  return async (to, code) => {
    const t = nodemailer.createTransport({ service: 'gmail', auth: { type: 'OAuth2', user: sel.user, clientId: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET, refreshToken: env.GMAIL_OAUTH_REFRESH_TOKEN } })
    await t.sendMail({ from: sel.from, to, subject: 'Your ORI code', text: mailBody(code) })
  }
}
