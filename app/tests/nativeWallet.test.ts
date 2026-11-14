import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveWallet, evmAddress, implicitAccountId, isNativeWallet, nearSendCheck, NO_RELAYER, parseKey, relayerUrl, solAddress, validateNearRecipient, PATHS, DOMAIN, NEAR_AUTH } from '../src/oriWallet.ts'
import { receiveDirectory } from '../src/receiveTargets.ts'

// Vectors read from mainnet v1.signer `derived_public_key` (predecessor example.near) and cross-checked against
// chainsig.js deriveAddressAndPublicKey on 9 Nov 2026.
const SECP = 'secp256k1:5zL9u9afiFPPrPmnH7rEz2t3szev5eZ7wXCwzYq37GYyCbJq3YNU31N4LTULioaw3chJx674XUncmYKiSCd3AxxT'
const ED = 'ed25519:3T1x6LQ9EtChr7sn83qYsBEUN3JWDEGiRSNb1DBi2U8d'
test('EVM address from MPC secp256k1 key matches chainsig.js', () => assert.equal(evmAddress(SECP), '0xEF4Ea05e5c11057DeCC8E1bd6F5369f2acD91fA5'))
test('Solana address from MPC ed25519 key matches chainsig.js', () => assert.equal(solAddress(ED), '3T1x6LQ9EtChr7sn83qYsBEUN3JWDEGiRSNb1DBi2U8d'))
test('implicit NEAR account is the 64-hex of the ed25519 key', () => { const id = implicitAccountId(ED); assert.match(id, /^[0-9a-f]{64}$/); assert.equal(Buffer.from(id, 'hex').length, 32) })
test('bad keys are rejected, never coerced', () => { for (const k of ['', 'ed25519:', 'secp256k1:abc', 'rsa:xyz', ED + 'x0']) assert.throws(() => parseKey(k)); assert.throws(() => evmAddress(ED)); assert.throws(() => solAddress(SECP)) })

const mockRpc = (fail: { evm?: boolean; sol?: boolean } = {}) => {
  const calls: any[] = []
  const f = (async (_url: string, init: any) => {
    const body = JSON.parse(init.body); const args = JSON.parse(Buffer.from(body.params.args_base64, 'base64').toString()); calls.push({ contract: body.params.account_id, method: body.params.method_name, args })
    const isEvm = args.domain_id === DOMAIN.secp256k1
    if ((isEvm && fail.evm) || (!isEvm && fail.sol)) return { ok: true, json: async () => ({ error: { message: 'boom' } }) }
    const v = isEvm ? SECP : ED
    return { ok: true, json: async () => ({ result: { result: [...Buffer.from(JSON.stringify(v))] } }) }
  }) as unknown as typeof fetch
  return { f, calls }
}
test('deriveWallet calls only the documented v1.signer view with the user implicit account as predecessor', async () => {
  const { f, calls } = mockRpc()
  const w = await deriveWallet('jwt#https://login.auth.near.org/#email|x', ED, f, 1)
  assert.equal(w.evm?.address, '0xEF4Ea05e5c11057DeCC8E1bd6F5369f2acD91fA5'); assert.equal(w.sol?.address, '3T1x6LQ9EtChr7sn83qYsBEUN3JWDEGiRSNb1DBi2U8d')
  assert.equal(calls.length, 2)
  for (const c of calls) { assert.equal(c.contract, NEAR_AUTH.mpcContractId); assert.equal(c.method, 'derived_public_key'); assert.equal(c.args.predecessor, w.nearAccountId) }
  assert.deepEqual(calls.map(c => c.args.path).sort(), [PATHS.evm, PATHS.sol].sort())
  assert.ok(isNativeWallet(w))
})
test('a chain that fails to derive stays null with a reason (no placeholder)', async () => {
  const w = await deriveWallet('p', ED, mockRpc({ evm: true }).f)
  assert.equal(w.evm, null); assert.ok(w.errors.evm); assert.ok(w.sol)
  const rows = receiveDirectory([], [], a => /^0x/.test(a) ? 'evm' : /^[0-9a-f]{64}$/.test(a) ? 'near' : 'sol', { near: w.nearAccountId, evm: null, sol: w.sol!.address, errors: w.errors })
  const base = rows.find(r => r.network === 'Base')!
  assert.equal(base.address, null); assert.equal(base.copyable, false); assert.ok(base.nativeError)
  assert.equal(rows.find(r => r.network === 'NEAR')!.source, 'native'); assert.equal(rows.find(r => r.network === 'Solana')!.copyable, true)
})
test('Receive lists one real native address per chain, Base and Ethereum share the EVM address', () => {
  const kind = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a) ? 'evm' as const : /^[0-9a-f]{64}$/.test(a) ? 'near' as const : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) ? 'sol' as const : null
  const near = implicitAccountId(ED)
  const rows = receiveDirectory([{ address: '0x1111111111111111111111111111111111111111', chain: 'evm' }], [], kind, { near, evm: '0xEF4Ea05e5c11057DeCC8E1bd6F5369f2acD91fA5', sol: solAddress(ED) })
  assert.deepEqual(rows.map(r => [r.network, r.source, r.copyable]), [['Base', 'native', true], ['Ethereum', 'native', true], ['Solana', 'native', true], ['NEAR', 'native', true]])
  assert.equal(rows[0].address, rows[1].address)
})
test('without a native wallet Receive is unchanged (connected/watched only)', () => {
  const rows = receiveDirectory([], [], () => null, null); assert.ok(rows.every(r => !r.copyable && r.address === null && !r.nativeError))
})
test('tampered stored wallet is rejected', () => {
  const ok = { v: 1, authPath: 'p', nearPublicKey: ED, nearAccountId: implicitAccountId(ED), evm: { address: '0xEF4Ea05e5c11057DeCC8E1bd6F5369f2acD91fA5', path: 'ethereum-1' }, sol: null, errors: {}, derivedAt: 1 }
  assert.ok(isNativeWallet(ok))
  assert.ok(!isNativeWallet({ ...ok, nearAccountId: 'a'.repeat(64) }))
  assert.ok(!isNativeWallet({ ...ok, evm: { address: 'not-an-address', path: 'x' } }))
})
test('NEAR recipients', () => {
  assert.equal(validateNearRecipient('alice.near'), null); assert.equal(validateNearRecipient('a'.repeat(64)), null)
  assert.ok(validateNearRecipient('')); assert.ok(validateNearRecipient('Alice.near')); assert.ok(validateNearRecipient('alice.testnet')); assert.ok(validateNearRecipient('x.near', 'x.near'))
})
const base = { to: 'alice.near', self: 'b'.repeat(64), units: 10n ** 24n, fee: 10n ** 20n, spendable: 5n * 10n ** 24n, usd: 3, caps: { perPay: 250, daily: 500 }, spent: 0, relayer: 'https://relay.example' }
test('NEAR send passes only when every check passes', () => assert.equal(nearSendCheck(base), null))
test('NEAR send fails closed: no relayer, limits, price, inactive account, balance', () => {
  assert.equal(nearSendCheck({ ...base, relayer: null }), NO_RELAYER)
  assert.match(nearSendCheck({ ...base, usd: 300 })!, /per-payment cap/)
  assert.match(nearSendCheck({ ...base, spent: 499 })!, /daily cap/)
  assert.match(nearSendCheck({ ...base, usd: 0 })!, /No live USD price/)
  assert.match(nearSendCheck({ ...base, spendable: null })!, /not on-chain yet/)
  assert.match(nearSendCheck({ ...base, spendable: 10n ** 24n })!, /Not enough NEAR/)
  assert.match(nearSendCheck({ ...base, fee: null })!, /fee is unavailable/)
  assert.match(nearSendCheck({ ...base, spent: NaN })!, /spending record/)
})
test('relayer URL must be https and is unset by default', () => {
  assert.equal(relayerUrl({}), null); assert.equal(relayerUrl({ VITE_ORI_NEAR_RELAYER_URL: 'http://x' }), null)
  assert.equal(relayerUrl({ VITE_ORI_NEAR_RELAYER_URL: 'https://r.example/api/' }), 'https://r.example/api')
})
test('NEAR Auth config is the approved mainnet client (public values only)', () => {
  assert.deepEqual([NEAR_AUTH.domain, NEAR_AUTH.clientId, NEAR_AUTH.signingAudience, NEAR_AUTH.fastAuthContractId, NEAR_AUTH.mpcContractId], ['login.auth.near.org', 'b6UA35Hea4utXEzCwwoTPnyikGiqwyiq', 'auth0.jwt.fast-auth.near', 'fast-auth.near', 'v1.signer'])
})
