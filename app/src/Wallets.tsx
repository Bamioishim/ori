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
      <div className="label">WALLETS · NON-CUSTODIAL</div><h2 className="big2">Your wallets,<br /><span className="dim">your keys.</span></h2>
      <p className="account-copy">Connect external wallets without giving ORI their private keys, or create an encrypted local vault for your own EVM and Solana addresses.</p>
      <div className="wallet-connect"><button className="cta compact" disabled={!!busy} onClick={() => connect('evm')}>{busy === 'evm' ? <Dots size={5} label="Connecting" /> : 'Connect MetaMask / Coinbase'}</button><button className="ghost" disabled={!!busy} onClick={() => connect('sol')}>{busy === 'sol' ? <Dots size={5} label="Connecting" /> : 'Connect Phantom'}</button></div>
      {error && <div className="mono xs err why">{error}</div>}
    </section>
    <section>
      <div className="sechead"><div className="label">CONNECTED WALLETS</div><span className="mono xs dim">{list.length} wallet{list.length === 1 ? '' : 's'}</span></div>
      {list.length ? list.map(w => <div className={'wallet-card ' + (w.id === (active || list[0]?.id) ? 'selected' : '')} key={w.id}>
        <button className="wallet-main" onClick={() => setActiveWallet(w.id)}><span className="wallet-mark">{w.chain === 'sol' ? 'S' : 'E'}</span><span className="grow"><b>{w.label}</b><span className="sub">{w.network} · {short(w.address)}</span></span><span className="mono xs">{w.id === (active || list[0]?.id) ? 'ACTIVE' : 'USE'}</span></button><button className="mono xs dim wallet-remove" onClick={() => removeWallet(w.id)}>DISCONNECT</button>
      </div>) : <div className="mono xs dim">No external wallets connected.</div>}
    </section>
    <section>
      <div className="sechead"><div className="label">ORI SELF-CUSTODY VAULT</div><span className="mono xs dim">{vaultExists ? vaultOpen ? 'UNLOCKED' : 'LOCKED' : 'NOT CREATED'}</span></div>
      {!vaultExists ? <>
        <p className="account-copy">Create one EVM address and one Solana address. Private keys are generated in this browser and encrypted with your password using PBKDF2 + AES-256-GCM. ORI does not receive your keys.</p>
        <label className="account-label">VAULT PASSWORD · 12 CHARACTERS MINIMUM<input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></label>
        <label className="account-label">CONFIRM PASSWORD<input className="field" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></label>
        <button className="cta" disabled={!!busy || password.length < 12 || !confirm} onClick={createVault}>{busy === 'vault' ? <Dots size={5} label="Creating encrypted vault" /> : 'Create native wallet'}</button>
        <label className="account-label why">IMPORT AN ENCRYPTED ORI BACKUP<textarea className="field" rows={3} value={backupText} onChange={e => setBackupText(e.target.value)} placeholder="Paste encrypted backup JSON" /></label>
        <button className="ghost" disabled={!!busy || !backupText.trim() || password.length < 12} onClick={importBackup}>Import backup with password</button>
      </> : <>
        <p className="account-copy">Your private keys are encrypted at rest on this device. The encrypted backup is portable, but it still needs your vault password. Losing both means losing access.</p>
        <div className="wallet-card"><div className="wallet-main"><span className="wallet-mark">E</span><span className="grow"><b>Native EVM</b><span className="sub mono">{vault?.evmAddress}</span></span></div><button className="mono xs dim wallet-remove" onClick={() => void navigator.clipboard.writeText(vault?.evmAddress || '')}>COPY ADDRESS</button></div>
        <div className="wallet-card"><div className="wallet-main"><span className="wallet-mark">S</span><span className="grow"><b>Native Solana</b><span className="sub mono">{vault?.solAddress}</span></span></div><button className="mono xs dim wallet-remove" onClick={() => void navigator.clipboard.writeText(vault?.solAddress || '')}>COPY ADDRESS</button></div>
        {!vaultOpen ? <>
          <label className="account-label">VAULT PASSWORD<input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
          <button className="cta" disabled={!!busy || !password} onClick={unlockVault}>{busy === 'vault' ? <Dots size={5} label="Unlocking" /> : 'Unlock vault'}</button>
        </> : <div className="wallet-connect"><button className="ghost" onClick={backup}>Copy encrypted backup</button><button className="ghost" onClick={lockVault}>Lock vault</button></div>}
      </>}
      {notice && <div className="mono xs dim why">{notice}</div>}
      {vaultExists && <div className="mono xs err why">IMPORTANT: Native transaction signing is not connected to Send yet. Do not deposit funds into these addresses until that integration is completed and tested. Passkey and Gmail recovery are also not implemented.</div>}
      <div className="mono xs dim why">Security note: browser encryption protects stored key material, but it is not a hardware wallet. A compromised device or malicious site script can still expose keys while the vault is unlocked.</div>
    </section>
    {addresses.length > 0 && <section>
      <div className="sechead"><div className="label">ON-CHAIN BALANCES · ALL SAVED ADDRESSES</div><span className="num">${total(byChain).toFixed(2)}</span></div>
      {byChain.length ? byChain.map((h, i) => <div className="row" key={h.sym + h.chain + h.addr + i}><span className="grow"><b>{h.sym}</b><span className="sub">{h.chain} · {short(h.addr)}</span></span><span className="num">{h.amt.toLocaleString('en-US', { maximumFractionDigits: 6 })}<span className="sub">${h.usd.toFixed(2)}</span></span></div>) : <div className="mono xs dim">{readError || 'No non-zero balances found yet.'}</div>}
      {readError && <div className="mono xs err why">{readError}</div>}
    </section>}
  </div>
}
