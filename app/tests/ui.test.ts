import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyText, flowParts, maskDigits, sanitizeOtp, SLIDE_IDLE, slideStep, type SlideEvent, type SlideState } from '../src/uiLogic.ts'
const run = (evs: SlideEvent[], disabled = false, s0: SlideState = SLIDE_IDLE) => { let s = s0, fires = 0; for (const e of evs) { const r = slideStep(s, e, disabled); s = r.s; if (r.fire) fires++ } return { s, fires } }
test('slide: only a full travel while held confirms, exactly once', () => {
  assert.deepEqual(run([{ t: 'down' }, { t: 'move', frac: .5 }, { t: 'move', frac: .99 }]).fires, 1)
  const r = run([{ t: 'down' }, { t: 'move', frac: 1 }, { t: 'move', frac: 1 }, { t: 'up' }, { t: 'down' }, { t: 'move', frac: 1 }, { t: 'key' }, { t: 'key' }])
  assert.equal(r.fires, 1); assert.equal(r.s.phase, 'done')
})
test('slide: partial travel, release, pointer cancel all reset without confirming', () => {
  for (const end of ['up', 'cancel'] as const) { const r = run([{ t: 'down' }, { t: 'move', frac: .97 }, { t: end }]); assert.equal(r.fires, 0); assert.deepEqual(r.s, SLIDE_IDLE) }
  assert.equal(run([{ t: 'move', frac: 1 }]).fires, 0) // move without press does nothing
  assert.equal(run([{ t: 'down' }, { t: 'move', frac: NaN }]).s.frac, 0)
})
test('slide: disabled ignores everything and resets', () => {
  assert.equal(run([{ t: 'down' }, { t: 'move', frac: 1 }, { t: 'key' }, { t: 'key' }], true).fires, 0)
  assert.deepEqual(run([{ t: 'move', frac: 1 }], true, { phase: 'drag', frac: .8 }).s, SLIDE_IDLE)
})
test('slide keyboard: needs two explicit presses; timeout or Esc disarms', () => {
  assert.equal(run([{ t: 'key' }]).fires, 0); assert.equal(run([{ t: 'key' }]).s.phase, 'armed')
  assert.equal(run([{ t: 'key' }, { t: 'key' }]).fires, 1)
  assert.equal(run([{ t: 'key' }, { t: 'timeout' }, { t: 'key' }]).fires, 0)
  assert.equal(run([{ t: 'key' }, { t: 'cancel' }, { t: 'key' }]).fires, 0)
})
test('OTP sanitization: digits only, capped, paste with spaces/dashes', () => {
  assert.equal(sanitizeOtp('12 34-56'), '123456'); assert.equal(sanitizeOtp('1234567890'), '123456'); assert.equal(sanitizeOtp('ab'), ''); assert.equal(sanitizeOtp('98765', 4), '9876'); assert.equal(sanitizeOtp(undefined as any), '')
})
test('copy: success only when the clipboard write resolves', async () => {
  let got = ''; assert.equal(await copyText('addr', { writeText: async t => { got = t } }), true); assert.equal(got, 'addr')
  assert.equal(await copyText('addr', { writeText: async () => { throw new Error('denied') } }), false)
  assert.equal(await copyText('addr', {}), false); assert.equal(await copyText('addr', undefined), false); assert.equal(await copyText('', { writeText: async () => {} }), false)
})
test('price flow is display-only: text is unchanged, only differing chars flagged', () => {
  const p = flowParts('$1,234.50', '$1,234.58'); assert.equal(p.map(x => x.ch).join(''), '$1,234.58'); assert.deepEqual(p.filter(x => x.changed).map(x => x.ch), ['8'])
  assert.ok(flowParts(null, '12.00').every(x => !x.changed)); assert.ok(flowParts('5', '5').every(x => !x.changed))
  assert.equal(flowParts('9.99', '10.01').map(x => x.ch).join(''), '10.01')
})
test('masked balance keeps layout, hides every digit', () => { assert.equal(maskDigits('1,234'), '•,•••'); assert.equal(maskDigits('0.0042'), '•.••••') })
