import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXAMPLE_HANDLES, resolveHandleWith } from '../src/handles.ts'
import { PREVIEW } from '../src/previewAddrs.ts'
import { gasReserve, heldAmount, spendableAmount } from '../src/uiLogic.ts'
import { formatEta, parseTimeEstimate, TIME_UNAVAILABLE } from '../src/quoteTime.ts'

test('@tolu and @ade are EXAMPLE handles mapped to PREVIEW.sol — not invented live payees', () => {
  assert.equal(EXAMPLE_HANDLES['@tolu'].address, PREVIEW.sol)
  assert.equal(EXAMPLE_HANDLES['@tolu'].example, true)
  assert.equal(EXAMPLE_HANDLES['@ade'].address, PREVIEW.sol)
})

test('resolveHandle falls back to EXAMPLE_HANDLES when /api/resolve has no verified entry', async () => {
  const fetch404: typeof fetch = async () => new Response(JSON.stringify({ error: 'This handle is not linked to a verified Solana address.' }), { status: 404 })
  const r = await resolveHandleWith(fetch404, '@tolu')
  assert.equal(r.example, true); assert.equal(r.address, PREVIEW.sol); assert.match(r.label, /example/i)
  await assert.rejects(resolveHandleWith(fetch404, '@nobody'), (e: any) => e?.kind === 'unregistered' || /not linked/i.test(String(e)))
})

test('resolveHandle prefers a verified directory entry over the example map', async () => {
  const real = 'So11111111111111111111111111111111111111112'
  const fetchOk: typeof fetch = async () => new Response(JSON.stringify({ handle: '@tolu', address: real, chain: 'solana', label: 'Tolu' }), { status: 200 })
  const r = await resolveHandleWith(fetchOk, '@tolu')
  assert.equal(r.example, false); assert.equal(r.address, real)
})

test('spendable amount reserves native gas and never invents a balance', () => {
  const held = [{ sym: 'SOL', chain: 'Solana', amt: 4.1 }, { sym: 'USDC', chain: 'Base', amt: 1120 }]
  assert.equal(heldAmount(held, 'SOL', 'sol'), 4.1)
  assert.equal(spendableAmount(held, 'SOL', 'sol'), 4.1 - gasReserve('SOL', 'sol'))
  assert.equal(spendableAmount(held, 'USDC', 'base'), 1120)
  assert.equal(spendableAmount(held, 'WIF', 'sol'), null)
  assert.ok(gasReserve('ETH', 'eth') > 0)
})

test('settlement times come from timeEstimate; missing → Time unavailable; 22s and 37s are not hardcoded app defaults', () => {
  assert.equal(parseTimeEstimate(22), 22); assert.equal(formatEta(22), '~22s')
  assert.equal(parseTimeEstimate(37), 37); assert.equal(formatEta(37), '~37s')
  assert.equal(parseTimeEstimate(undefined), null); assert.equal(formatEta(null), TIME_UNAVAILABLE)
  assert.equal(parseTimeEstimate(0), null)
  // Distinct route samples from the public dry API (Nov 5): SOL→baseUSDC≈22, baseUSDC→solUSDC≈32, eth→SOL≈42
  assert.notEqual(22, 37)
})
