import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_RESEND_FROM, MAIL_MISSING, mailBody, mailerFromEnv, selectMailer } from '../api/auth/_mail.ts'
import { sendCode } from '../api/auth/_codes.ts'
import type { AuthStore } from '../api/auth/_store.ts'

function memStore(): AuthStore {
  const hits = new Map<string, number>(), used = new Set<string>()
  return { async hit(k) { const n = (hits.get(k) || 0) + 1; hits.set(k, n); return n }, async consumeOnce(id) { if (used.has(id)) return false; used.add(id); return true } }
}

const gmail = { GMAIL_OAUTH_USER: 'sender@gmail.com', GMAIL_OAUTH_FROM: 'ORI <sender@gmail.com>', GOOGLE_OAUTH_CLIENT_ID: 'id', GOOGLE_OAUTH_CLIENT_SECRET: 'sec', GMAIL_OAUTH_REFRESH_TOKEN: 'ref' }

test('selectMailer: neither provider → null; incomplete Gmail → null', () => {
  assert.equal(selectMailer({}), null)
  assert.equal(selectMailer({ RESEND_FROM_EMAIL: DEFAULT_RESEND_FROM }), null)
  assert.equal(selectMailer({ GMAIL_OAUTH_USER: 'sender@gmail.com', GOOGLE_OAUTH_CLIENT_ID: 'id' }), null)
})

test('selectMailer: Resend uses default from, then override; preferred over Gmail', () => {
  assert.deepEqual(selectMailer({ RESEND_API_KEY: 're_test' }), { kind: 'resend', from: DEFAULT_RESEND_FROM })
  assert.deepEqual(selectMailer({ RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'ORI <codes@example.com>' }), { kind: 'resend', from: 'ORI <codes@example.com>' })
  assert.equal(selectMailer({ RESEND_API_KEY: 're_test', ...gmail })?.kind, 'resend')
})

test('selectMailer: complete Gmail OAuth is the fallback', () => {
  assert.deepEqual(selectMailer(gmail), { kind: 'gmail', user: 'sender@gmail.com', from: 'ORI <sender@gmail.com>' })
  assert.deepEqual(selectMailer({ ...gmail, GMAIL_OAUTH_FROM: undefined }), { kind: 'gmail', user: 'sender@gmail.com', from: 'sender@gmail.com' })
})

test('Resend mailer posts to api.resend.com with bearer auth, default from, and the code in the body', async () => {
  const calls: { url: string; auth: string; body: Record<string, unknown> }[] = []
  const send = mailerFromEnv({ RESEND_API_KEY: 're_test' }, async (url, init) => {
    calls.push({ url, auth: String((init!.headers as Record<string, string>).authorization), body: JSON.parse(String(init!.body)) })
    return new Response('{}', { status: 200 })
  })
  assert.ok(send)
  await send!('a@gmail.com', '123456')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.resend.com/emails')
  assert.equal(calls[0].auth, 'Bearer re_test')
  assert.deepEqual(calls[0].body, { from: DEFAULT_RESEND_FROM, to: ['a@gmail.com'], subject: 'Your ORI code', text: mailBody('123456') })
})

test('Resend mailer uses RESEND_FROM_EMAIL when set, and surfaces HTTP errors', async () => {
  const send = mailerFromEnv({ RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'ORI <codes@example.com>' }, async (_u, init) => {
    const body = JSON.parse(String(init!.body))
    assert.equal(body.from, 'ORI <codes@example.com>')
    return new Response('no', { status: 401 })
  })
  await assert.rejects(() => send!('a@gmail.com', '111111'), /401/)
})

test('send-code with a store but no mailer returns the mail-not-configured error, not the store error', async () => {
  const r = await sendCode('a@gmail.com', 'ip', 'login', { store: memStore(), secret: 'test-secret-not-real' })
  assert.equal(r.status, 503)
  assert.equal(r.body.error, MAIL_MISSING)
  assert.doesNotMatch(String(r.body.error), /durable server store/)
})

test('mailerFromEnv is undefined when no provider is configured', () => {
  assert.equal(mailerFromEnv({}), undefined)
  assert.ok(mailerFromEnv({ RESEND_API_KEY: 're_test' }, async () => new Response('{}', { status: 200 })))
})

test('selectMailer: Gmail app password beats the Resend sandbox sender, but not a verified Resend sender', () => {
  const app = { GMAIL_SMTP_USER: 'sender@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' }
  assert.deepEqual(selectMailer(app), { kind: 'gmail-app', user: 'sender@gmail.com', from: 'ORI <sender@gmail.com>' })
  assert.equal(selectMailer({ RESEND_API_KEY: 're_test', ...app })?.kind, 'gmail-app')
  assert.equal(selectMailer({ RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'ORI <codes@example.com>', ...app })?.kind, 'resend')
  assert.equal(selectMailer({ GMAIL_SMTP_USER: 'sender@gmail.com' }), null)
})
