import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('Profile chain chips use official Trust Wallet logos, not letter initials', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const logos = readFileSync(new URL('../src/tokenLogos.ts', import.meta.url), 'utf8')
  const account = readFileSync(new URL('../src/Account.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /pchip[^\n]*\{a\.chain\[0\]\}/)
  assert.match(app, /<ChainMark chain=\{a\.chain\}/)
  assert.match(app, /CHAIN_LOGOS\[chain\]/)
  assert.match(logos, /trustwallet\/assets/)
  assert.match(logos, /\/ethereum\/info\/logo\.png/)
  assert.match(logos, /\/solana\/info\/logo\.png/)
  assert.match(logos, /\/near\/info\/logo\.png/)
  assert.match(logos, /\/base\/info\/logo\.png/)
  assert.match(logos, /Ethereum: TOKEN_LOGOS\.ETH/)
  assert.match(logos, /Base: TOKEN_LOGOS\.BASE/)
  assert.match(logos, /Solana: TOKEN_LOGOS\.SOL/)
  assert.match(logos, /NEAR: TOKEN_LOGOS\.NEAR/)
  // Account sheet has no chain-address letter chips to replace
  assert.doesNotMatch(account, /pchip|chain\[0\]|CHAIN ADDRESSES/)
})
