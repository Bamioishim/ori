import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'

const values = new Map<string, string>()
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
  removeItem: (key: string) => { values.delete(key) },
}, configurable: true })

const vault = await import('../src/nativeVault.ts')

test('native vault creates EVM and Solana keys and stores only encrypted secret material', async () => {
  values.clear()
  const meta = await vault.createNativeVault('correct horse battery staple')
  assert.match(meta.evmAddress, /^0x[0-9a-f]{40}$/i)
  assert.match(meta.solAddress, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
  const backup = vault.exportEncryptedVaultBackup()
  assert.equal(backup.includes('evmPrivateKey'), false)
  assert.equal(backup.includes('solSecretKey'), false)
  assert.ok(vault.getUnlockedVault())
  vault.lockNativeVault()
  assert.equal(vault.getUnlockedVault(), null)
  await assert.rejects(vault.unlockNativeVault('incorrect password'), /Incorrect vault password/)
  await vault.unlockNativeVault('correct horse battery staple')
  assert.equal(vault.getUnlockedVault()?.evmAddress, meta.evmAddress)
  assert.equal(vault.getUnlockedVault()?.solAddress, meta.solAddress)
})

test('encrypted backup restores the same addresses and wrong passwords do not overwrite data', async () => {
  const backup = vault.exportEncryptedVaultBackup()
  const meta = vault.nativeVaultMetadata()!
  await assert.rejects(vault.importEncryptedVaultBackup(backup, 'wrong password'), /Incorrect vault password/)
  assert.equal(vault.nativeVaultMetadata()?.evmAddress, meta.evmAddress)
  await vault.removeNativeVault('correct horse battery staple')
  assert.equal(vault.hasNativeVault(), false)
  const restored = await vault.importEncryptedVaultBackup(backup, 'correct horse battery staple')
  assert.equal(restored.evmAddress, meta.evmAddress)
  assert.equal(restored.solAddress, meta.solAddress)
  await vault.removeNativeVault('correct horse battery staple')
})

test('vault rejects weak passwords and refuses to replace an existing vault', async () => {
  values.clear()
  await assert.rejects(vault.createNativeVault('short'), /at least 12 characters/)
  await vault.createNativeVault('another strong passphrase')
  await assert.rejects(vault.createNativeVault('another strong passphrase'), /already exists/)
  await vault.removeNativeVault('another strong passphrase')
})
