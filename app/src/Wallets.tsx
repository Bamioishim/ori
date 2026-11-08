import { useEffect, useMemo, useState } from 'react'
import { readPortfolio, short, type Holding } from './live'
import { connectWallet, removeWallet, setActiveWallet, useManagedWallets } from './wallets'
import { Dots } from './Loaders'
import { createNativeVault, exportEncryptedVaultBackup, getUnlockedVault, hasNativeVault, importEncryptedVaultBackup, lockNativeVault, nativeVaultMetadata, unlockNativeVault } from './nativeVault'

const total = (h: Holding[]) => h.reduce((n, x) => n + x.usd, 0)
export default function WalletsScreen() {
  const { list, active } = useManagedWallets()
  const [busy, setBusy] = useState<'evm' | 'sol' | 'vault' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [readError, setReadError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [backupText, setBackupText] = useState('')
  const [vaultExists, setVaultExists] = useState(hasNativeVault())
  const [vaultOpen, setVaultOpen] = useState(!!getUnlockedVault())
  const [vault, setVault] = useState(nativeVaultMetadata())
  const addresses = [...list.map(w => w.address), ...(vault ? [vault.evmAddress, vault.solAddress] : [])]
  useEffect(() => { const lockWhenHidden = () => { if (document.hidden) { lockNativeVault(); setVaultOpen(false) } }; document.addEventListener('visibilitychange', lockWhenHidden); return () => { document.removeEventListener('visibilitychange', lockWhenHidden); lockNativeVault() } }, [])
  useEffect(() => {
    let dead = false
    setHoldings([])
    setReadError('')
    if (!addresses.length) return
    readPortfolio([...new Set(addresses)]).then(r => { if (!dead) { setHoldings(r.holdings); setReadError(r.errors.join(' · ')) } })
      .catch(e => { if (!dead) setReadError((e as Error).message) })
    return () => { dead = true }
  }, [list.map(w => w.address).join('|'), vault?.evmAddress, vault?.solAddress])
  const byChain = useMemo(() => holdings.filter(h => h.amt > 0), [holdings])
  const connect = async (kind: 'evm' | 'sol') => { setBusy(kind); setError(''); setNotice(''); try { await connectWallet(kind) } catch (e) { setError((e as Error).message) } finally { setBusy(null) } }
  const refreshVault = () => { setVaultExists(hasNativeVault()); setVault(nativeVaultMetadata()); setVaultOpen(!!getUnlockedVault()) }
  const createVault = async () => {
    setBusy('vault'); setError(''); setNotice('')
    try {
      if (password !== confirm) throw new Error('The vault passwords do not match.')
      await createNativeVault(password); refreshVault(); setPassword(''); setConfirm('')
      setNotice('Your EVM and Solana keys were generated and encrypted on this device. Export the encrypted backup now.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }
  const unlockVault = async () => {
    setBusy('vault'); setError(''); setNotice('')
    try { await unlockNativeVault(password); refreshVault(); setPassword(''); setNotice('Vault unlocked in this browser session.') }
    catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }
  const importBackup = async () => {
    setBusy('vault'); setError(''); setNotice('')
    try { await importEncryptedVaultBackup(backupText, password); refreshVault(); setPassword(''); setBackupText(''); setNotice('Encrypted wallet backup imported and unlocked.') }
    catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }
  const backup = async () => {
    setError(''); setNotice('')
    try { await navigator.clipboard.writeText(exportEncryptedVaultBackup()); setNotice('Encrypted backup copied. Keep it somewhere private; you need the vault password to restore it.') }
    catch { setError('Clipboard access failed. Try again from your browser’s secure context.') }
  }
  const lockVault = () => { lockNativeVault(); refreshVault(); setNotice('Vault locked. Key material was cleared from ORI’s in-memory session.') }
  return <div className="pg wallets-page">
    <section className="pad-top">
      <div className="label">ORI WALLET · SELF-CUSTODY</div><h2 className="big2">Your wallet.<br /><span className="dim">No connection needed.</span></h2>
      <p className="account-copy">Create a wallet directly in ORI. Your EVM and Solana addresses are generated on this device. No MetaMask, Phantom, external wallet connection, or passkey required.</p>
      {error && <div className="mono xs err why">{error}</div>}
      {!vaultExists ? <>
        <label className="account-label">CREATE A LOCAL VAULT PASSWORD · 12 CHARACTERS MINIMUM<input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></label>
        <label className="account-label">CONFIRM PASSWORD<input className="field" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></label>
        <button className="cta" disabled={!!busy || password.length < 12 || !confirm} onClick={createVault}>{busy === 'vault' ? <Dots size={5} label="Creating your wallet" /> : 'Create my ORI wallet'}</button>
        <p className="mono xs dim why">This password encrypts your wallet on this device. It is not a passkey and does not connect to another wallet.</p>
        <label className="account-label why">OR RESTORE AN ENCRYPTED ORI BACKUP<textarea className="field" rows={3} value={backupText} onChange={e => setBackupText(e.target.value)} placeholder="Paste encrypted backup JSON" /></label>
        <button className="ghost" disabled={!!busy || !backupText.trim() || password.length < 12} onClick={importBackup}>Restore backup</button>
      </> : <>
        <div className="sechead"><div className="label">YOUR ORI ADDRESSES</div><span className="mono xs dim">{vaultOpen ? 'UNLOCKED' : 'LOCKED'}</span></div>
        <div className="wallet-card"><div className="wallet-main"><span className="wallet-mark">E</span><span className="grow"><b> EVM wallet</b><span className="sub mono">{vault?.evmAddress}</span></span></div><button className="mono xs dim wallet-remove" onClick={() => void navigator.clipboard.writeText(vault?.evmAddress || '').then(() => setNotice('EVM address copied.'))}>COPY ADDRESS</button></div>
        <div className="wallet-card"><div className="wallet-main"><span className="wallet-mark">S</span><span className="grow"><b>Solana wallet</b><span className="sub mono">{vault?.solAddress}</span></span></div><button className="mono xs dim wallet-remove" onClick={() => void navigator.clipboard.writeText(vault?.solAddress || '').then(() => setNotice('Solana address copied.'))}>COPY ADDRESS</button></div>
        {!vaultOpen ? <>
          <label className="account-label">VAULT PASSWORD<input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
          <button className="cta" disabled={!!busy || !password} onClick={unlockVault}>{busy === 'vault' ? <Dots size={5} label="Unlocking" /> : 'Unlock wallet'}</button>
        </> : <div className="wallet-connect"><button className="ghost" onClick={backup}>Copy encrypted backup</button><button className="ghost" onClick={lockVault}>Lock wallet</button></div>}
        {notice && <div className="mono xs dim why">{notice}</div>}
        <div className="mono xs err why">Do not deposit funds yet. Native transaction signing is not connected to Send, and passkey/Gmail recovery is not implemented.</div>
      </>}
      <div className="mono xs dim why">Your keys are encrypted on this device. Keep an encrypted backup and your password safe. Browser storage is not hardware-wallet security.</div>
    </section>
    <section>
      <div className="sechead"><div className="label">OPTIONAL · CONNECT AN EXISTING WALLET</div><span className="mono xs dim">{list.length} connected</span></div>
      <p className="account-copy">Already use MetaMask, Coinbase Wallet, or Phantom? You can connect one here. This is optional and not needed to create or copy your ORI wallet addresses.</p>
      <div className="wallet-connect"><button className="ghost" disabled={!!busy} onClick={() => connect('evm')}>{busy === 'evm' ? <Dots size={5} label="Connecting" /> : 'Connect MetaMask / Coinbase'}</button><button className="ghost" disabled={!!busy} onClick={() => connect('sol')}>{busy === 'sol' ? <Dots size={5} label="Connecting" /> : 'Connect Phantom'}</button></div>
      {list.length ? list.map(w => <div className={'wallet-card ' + (w.id === (active || list[0]?.id) ? 'selected' : '')} key={w.id}>
        <button className="wallet-main" onClick={() => setActiveWallet(w.id)}><span className="wallet-mark">{w.chain === 'sol' ? 'S' : 'E'}</span><span className="grow"><b>{w.label}</b><span className="sub">{w.network} · {short(w.address)}</span></span><span className="mono xs">{w.id === (active || list[0]?.id) ? 'ACTIVE' : 'USE'}</span></button><button className="mono xs dim wallet-remove" onClick={() => removeWallet(w.id)}>DISCONNECT</button>
      </div>) : <div className="mono xs dim">No external wallets connected.</div>}
    </section>
    {addresses.length > 0 && <section>
      <div className="sechead"><div className="label">ON-CHAIN BALANCES · ALL SAVED ADDRESSES</div><span className="num">${total(byChain).toFixed(2)}</span></div>
      {byChain.length ? byChain.map((h, i) => <div className="row" key={h.sym + h.chain + h.addr + i}><span className="grow"><b>{h.sym}</b><span className="sub">{h.chain} · {short(h.addr)}</span></span><span className="num">{h.amt.toLocaleString('en-US', { maximumFractionDigits: 6 })}<span className="sub">${h.usd.toFixed(2)}</span></span></div>) : <div className="mono xs dim">{readError || 'No non-zero balances found yet.'}</div>}
      {readError && <div className="mono xs err why">{readError}</div>}
    </section>}
  </div>
}
