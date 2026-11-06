import { test } from 'node:test'
import assert from 'node:assert/strict'
import { txAmountLabel, txStatusLabel } from '../src/historyLabels.ts'

const demo = { amount: '-50', asset: 'USDC', status: 'completed' as const, demo: true }
const real = { amount: '-50', asset: 'USDC', status: 'completed' as const }

test('demo list/detail amount is not a real debit label', () => {
  assert.equal(txAmountLabel(demo), '50 USDC · simulated')
  assert.doesNotMatch(txAmountLabel(demo), /^-/)
  assert.equal(txAmountLabel(real), '-50 USDC')
})

test('demo list/detail status is DEMO · simulated, not Completed', () => {
  assert.equal(txStatusLabel(demo), 'DEMO · simulated')
  assert.notEqual(txStatusLabel(demo), 'Completed')
  assert.equal(txStatusLabel(real), 'Completed')
})
