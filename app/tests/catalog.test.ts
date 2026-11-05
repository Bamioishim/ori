import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeTokens, originAdapter, validAddressFor, validateRoute } from '../api/_catalog.ts'
// Fixture: real public GET /v0/tokens response captured Nov 5 2026 (no keys involved).
const cat = normalizeTokens(JSON.parse(readFileSync(new URL('./fixture-tokens.json', import.meta.url), 'utf8')))
const id = (sym: string, chain: string) => cat.find(t => t.symbol === sym && t.blockchain === chain)!.assetId
const EVM = '0x' + '12'.repeat(20), SOL = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
test('catalog normalizes the full live list, many chains, not just Base/Solana USDC', () => {
  assert.ok(cat.length > 150); assert.ok(new Set(cat.map(t => t.blockchain)).size > 20)
  assert.deepEqual(normalizeTokens([{ assetId: 'bad id', symbol: 'X', blockchain: 'eth', decimals: 6 }, { assetId: 'nep141:x.near', symbol: 'X', blockchain: 'near', decimals: 99 }, null, 5]), [])
  assert.equal(normalizeTokens('nope').length, 0)
})
test('routable ≠ executable: only ETH/ERC-20 on Ethereum+Base and native SOL have signing adapters', () => {
  assert.deepEqual(originAdapter(cat.find(t => t.assetId === id('USDC', 'base'))!), { net: 'Base', kind: 'erc20', token: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' })
  assert.equal(originAdapter(cat.find(t => t.assetId === id('ETH', 'eth'))!)!.kind, 'native')
  assert.equal(originAdapter(cat.find(t => t.assetId === id('SOL', 'sol'))!)!.kind, 'native')
  { const u = cat.find(t => t.assetId === id('USDC', 'sol')); if (u) assert.deepEqual(originAdapter(u), u.contractAddress === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? { net: 'Solana', kind: 'spl', token: u.contractAddress } : null) }
  assert.equal(originAdapter(cat.find(t => t.symbol === '$WIF')!), null) // untrusted SPL mint stays quote-only
  assert.equal(originAdapter({ ...cat.find(t => t.assetId === id('SOL', 'sol'))!, symbol: 'USDC', contractAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 }), null) // wrong mint posing as USDC
  assert.equal(originAdapter(cat.find(t => t.blockchain === 'btc')!), null); assert.equal(originAdapter(cat.find(t => t.blockchain === 'near')!), null)
})
test('server route validation is strict against the trusted catalog', () => {
  const ok = validateRoute(cat, { originAsset: id('ETH', 'base'), destinationAsset: id('SOL', 'sol'), amount: '1000', recipient: SOL, refundTo: EVM })
  assert.equal(typeof ok, 'object')
  assert.match(validateRoute(cat, { originAsset: 'nep141:evil.near', destinationAsset: id('SOL', 'sol'), amount: '1', recipient: SOL, refundTo: EVM }) as string, /not in the NEAR Intents token list/)
  assert.equal(typeof validateRoute(cat, { originAsset: id('USDC', 'sol'), destinationAsset: id('ETH', 'base'), amount: '1', recipient: EVM, refundTo: SOL }), 'object') // trusted SPL origin
  assert.match(validateRoute(cat, { originAsset: cat.find(t => t.symbol === '$WIF')!.assetId, destinationAsset: id('ETH', 'base'), amount: '1', recipient: EVM, refundTo: SOL }) as string, /cannot sign/)
  assert.match(validateRoute(cat, { originAsset: id('ETH', 'base'), destinationAsset: id('SOL', 'sol'), amount: '1', recipient: EVM, refundTo: EVM }) as string, /Recipient/)
  assert.match(validateRoute(cat, { originAsset: id('ETH', 'base'), destinationAsset: id('SOL', 'sol'), amount: '-1', recipient: SOL, refundTo: EVM }) as string, /positive/)
  assert.match(validateRoute(cat, { originAsset: id('ETH', 'base'), destinationAsset: id('ETH', 'base'), amount: '1', recipient: EVM, refundTo: EVM }) as string, /direct transfer/)
  const btc = cat.find(t => t.blockchain === 'btc')!.assetId
  assert.match(validateRoute(cat, { originAsset: id('ETH', 'base'), destinationAsset: btc, amount: '1', recipient: 'bc1qxyz', refundTo: EVM }) as string, /cannot validate|not a valid/)
})
test('address validation per chain', () => { assert.ok(validAddressFor('arb', EVM)); assert.ok(!validAddressFor('arb', SOL)); assert.ok(validAddressFor('near', 'alice.near')); assert.ok(!validAddressFor('ton', 'x')) })
test('backend: JWT guard kept, no appFees added, catalog validation used', () => {
  const s = readFileSync(new URL('../api/_oneclick.ts', import.meta.url), 'utf8') + readFileSync(new URL('../api/quote.ts', import.meta.url), 'utf8')
  assert.match(s, /if \(!jwt\) return json\(\{ error: 'Live settlement is not configured\.' \}, 503\)/)
  assert.doesNotMatch(s, /appFees|ALLOWED_ASSETS/); assert.match(s, /await validateQuoteInput/)
})
test('swap UI uses the catalog, not a hardcoded pair', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'); const sw = app.slice(app.indexOf('function Swap('), app.indexOf('function Swap(') + 12000)
  assert.match(sw, /normalizeTokens\(ts\)/); assert.match(sw, /<TokenPick /); assert.doesNotMatch(sw, /flip \? \{ s: 'USDC'/)
})
