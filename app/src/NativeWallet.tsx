import { useEffect, useState } from 'react'
import { Dots } from './Loaders'
import { CopyButton } from './ui'
import { NATIVE_EVENT, NEAR_AUTH, NO_RELAYER, forgetNativeWallet, loadNativeWallet, saveNativeWallet, relayerUrl, type NativeWallet } from './oriWallet'
import { deriveFromSession, isLoggedIn, loadNearAuth, loginPopup, logout } from './nearAuth'
import { fromUnits, toUnits } from './transfers'
import { addSpent, spentToday, type Settings } from './settings'
import { logTransaction, updateTransaction } from './transactions'
import { price as priceOf, tokens } from './live'
import { nearBalance, nearFee, nearSendCheck, spendable, validateNearRecipient, YOCTO } from './oriWallet'
import { prepareNearTransfer, sendPreparedNear, type PreparedNear } from './nearAuth'

export function useNativeWallet() {
  const [wallet, setWallet] = useState<NativeWallet | null>(() => loadNativeWallet())
  useEffect(() => { const on = () => setWallet(loadNativeWallet()); addEventListener(NATIVE_EVENT, on); addEventListener('storage', on); return () => { removeEventListener(NATIVE_EVENT, on); removeEventListener('storage', on) } }, [])
  return wallet
}

const loginHelp = (m: string) => /popup/i.test(m) && /block|open/i.test(m) ? 'Your browser blocked the NEAR Auth window. Allow pop-ups for ORI and try again.'
  : /cancel|closed/i.test(m) ? 'The NEAR Auth window was closed before sign-in finished. No wallet was created.'
  : /timeout/i.test(m) ? 'NEAR Auth sign-in timed out. No wallet was created.'
  : m

/** Create / restore the ORI wallet through NEAR Auth (passkey or email on the hosted screen). No seed phrase. */
export function NativeWalletCard({ compact = false }: { compact?: boolean }) {
  const wallet = useNativeWallet()
  const [sdk, setSdk] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState<'' | 'login' | 'derive' | 'logout'>('')
  const [err, setErr] = useState('')
  const [session, setSession] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  useEffect(() => { let dead = false; loadNearAuth().then(() => { if (dead) return; setSdk('ready'); isLoggedIn().then(v => !dead && setSession(v)) }).catch(e => { if (!dead) { setSdk('error'); setLoadErr((e as Error)?.message || String(e)) } }); return () => { dead = true } }, [])

  const derive = async () => {
    setBusy('derive')
    try { const w = await deriveFromSession(); saveNativeWallet(w); setSession(true) }
    catch (e) { setErr(`Signed in, but ORI could not derive your addresses: ${(e as Error).message}. Nothing was saved.`) }
    finally { setBusy('') }
  }
  // Popup must open inside the click; loginPopup runs synchronously up to window.open.
  const create = (force = false) => {
    setErr(''); setBusy('login')
    loginPopup(force).then(derive).catch(e => { setErr(loginHelp((e as Error).message || String(e))); setBusy('') })
  }
  const signOut = async () => { setBusy('logout'); try { await logout() } catch { /* session ends locally anyway */ } finally { setSession(false); setBusy('') } }

  const stateLine = !wallet ? null : session ? 'Signed in with NEAR Auth' : 'Signed out · addresses saved on this device (public only)'
  return <section className="native-wallet">
    <div className="label">ORI WALLET · NEAR AUTH</div>
    {!wallet ? <>
      {!compact && <h3>Your own wallet, no seed phrase</h3>}
      <p className="mono xs dim">ORI creates your wallet from a NEAR Auth login. Use a passkey or your email on the NEAR Auth screen; signing in again with the same login recovers the same wallet on any device. No private key or recovery phrase is ever shown or stored by ORI: the key is split across NEAR’s MPC network.</p>
      <button className="cta compact" disabled={sdk !== 'ready' || !!busy} onClick={() => create(false)}>{busy === 'login' ? <Dots size={5} label="Waiting for NEAR Auth" /> : busy === 'derive' ? <Dots size={5} label="Deriving addresses" /> : sdk === 'loading' ? 'Loading NEAR Auth…' : 'Create ORI wallet'}</button>
      {sdk === 'error' && <p className="mono xs err why">NEAR Auth could not load{loadErr ? ` (${loadErr})` : ''}. The rest of ORI still works; try again later.</p>}
    </> : <>
      <div className="row"><span className="grow"><b>NEAR account</b><span className="sub mono">{wallet.nearAccountId.slice(0, 10)}…{wallet.nearAccountId.slice(-6)}</span></span><a className="mono xs" href={`${NEAR_AUTH.explorer}/address/${wallet.nearAccountId}`} target="_blank" rel="noreferrer">nearblocks</a></div>
      <p className="mono xs dim">{stateLine}. Recover it by signing in to NEAR Auth with the same login (same passkey or same email) you used to create it. A different login opens a different wallet.</p>
      <span className="rowbtns">
        {!session && <button className="ghost" disabled={sdk !== 'ready' || !!busy} onClick={() => create(false)}>{busy === 'login' || busy === 'derive' ? <Dots size={5} label="Signing in" /> : 'Sign in to ORI wallet'}</button>}
        {session && <button className="ghost" disabled={!!busy} onClick={derive}>{busy === 'derive' ? <Dots size={5} label="Re-deriving" /> : 'Re-check addresses'}</button>}
        {session && <button className="ghost" disabled={!!busy} onClick={signOut}>Sign out</button>}
        {!session && <button className="ghost" onClick={() => { if (confirm('Remove the ORI wallet addresses from this device? Your wallet is not deleted; sign in with the same NEAR Auth login to restore it.')) forgetNativeWallet() }}>Remove from this device</button>}
      </span>
      {!compact && <details className="mono xs dim"><summary>Technical details</summary>
        <div>NEAR Auth path: {wallet.authPath}</div><div>NEAR key: {wallet.nearPublicKey}</div>
        <div>Signer: {NEAR_AUTH.fastAuthContractId} → {NEAR_AUTH.mpcContractId} (mainnet)</div>
        <div>Chain Signatures paths: EVM {wallet.evm?.path ?? 'unavailable'} · Solana {wallet.sol?.path ?? 'unavailable'}</div>
        <div>Signing relayer: {relayerUrl() ? 'configured' : 'not configured (sending disabled)'}</div>
        <CopyButton text={wallet.nearAccountId} label="Copy NEAR account id" />
      </details>}
    </>}
    {err && <p className="mono xs err why" role="alert">{err}</p>}
  </section>
}

// ---- Native NEAR send (same-chain) ----

export function NativeNearSend({ cfg }: { cfg: Settings }) {
  const w = useNativeWallet()
  const [to, setTo] = useState(''); const [amt, setAmt] = useState('')
  const [px, setPx] = useState<number | null>(null); const [fee, setFee] = useState<bigint | null>(null)
  const [bal, setBal] = useState<bigint | null | undefined>(undefined)
  const [stage, setStage] = useState<'edit' | 'preparing' | 'review' | 'signing' | 'done'>('edit')
  const [err, setErr] = useState(''); const [prep, setPrep] = useState<PreparedNear | null>(null)
  const [res, setRes] = useState<{ hash: string; status: string } | null>(null)
  const relayer = relayerUrl()
  useEffect(() => { let dead = false; tokens().then(ts => { if (!dead) { const v = priceOf(ts, 'NEAR', 'near'); setPx(v > 0 ? v : null) } }).catch(() => !dead && setPx(null)); nearFee().then(f => !dead && setFee(f)).catch(() => !dead && setFee(null)); return () => { dead = true } }, [])
  useEffect(() => { let dead = false; setBal(undefined); if (!w) return; nearBalance(w.nearAccountId).then(b => !dead && setBal(b ? spendable(b) : null)).catch(() => !dead && setBal(null)); return () => { dead = true } }, [w?.nearAccountId])
  if (!w) return <><div className="mono xs dim why">Sending NEAR uses your ORI wallet. Create it first; it takes one NEAR Auth sign-in.</div><NativeWalletCard compact /></>
  const units = toUnits(amt, YOCTO)
  const usd = units && px ? Number(fromUnits(units, YOCTO, 8)) * px : 0
  const recipientError = to ? validateNearRecipient(to, w.nearAccountId) : null
  const check = () => nearSendCheck({ to: to.trim(), self: w.nearAccountId, units, fee, spendable: bal ?? null, usd, caps: cfg, spent: spentToday(), relayer })
  const review = async () => {
    setErr(''); const why = check(); if (why) { setErr(why); return }
    setStage('preparing')
    try { setPrep(await prepareNearTransfer(w, to.trim(), units!)); setStage('review') } catch (e) { setErr((e as Error).message); setStage('edit') }
  }
  // Runs inside the click so the NEAR Auth approval popup opens.
  const sign = () => {
    if (!prep) return; const why = check(); if (why) { setErr(why); setStage('edit'); return }
    setStage('signing'); setErr('')
    const tx = logTransaction({ kind: 'send', status: 'submitted', amount: `-${amt}`, asset: 'NEAR', network: 'NEAR', to: to.trim(), note: 'Waiting for NEAR Auth approval' })
    sendPreparedNear(prep).then(r => {
      updateTransaction(tx.id, { status: r.status === 'confirmed' ? 'completed' : r.status === 'failed' ? 'failed' : 'pending', txHash: r.hash, explorer: `${NEAR_AUTH.explorer}/txns/${r.hash}`, note: r.status === 'confirmed' ? 'Confirmed on NEAR' : r.status === 'failed' ? 'Failed on NEAR' : 'Submitted; not confirmed yet' })
      if (r.status !== 'failed') addSpent(usd)
      setRes(r); setStage('done')
    }).catch(e => { updateTransaction(tx.id, { status: 'cancelled', note: 'Not sent: approval cancelled or relaying failed before broadcast' }); setErr((e as Error).message || 'NEAR Auth did not sign. Nothing was sent.'); setStage('edit'); setPrep(null) })
  }
  return <>
    <div className="row"><span className="grow">From<br /><span className="mono xs dim">ORI wallet {w.nearAccountId.slice(0, 8)}…{w.nearAccountId.slice(-4)} · NEAR Auth signs</span></span>
      <span className="num">{bal === undefined ? '…' : bal === null ? 'Not active' : `${fromUnits(bal, YOCTO, 5)} NEAR`}</span></div>
    {bal === null && <div className="mono xs dim why">This NEAR account activates when it first receives NEAR. Copy it from Receive.</div>}
    {!relayer && <div className="mono xs err why">{NO_RELAYER}</div>}
    <div className="row"><input className="field" value={to} onChange={e => { setTo(e.target.value); setStage('edit'); setPrep(null) }} placeholder="name.near or implicit account" aria-label="Recipient NEAR account" spellCheck={false} autoComplete="off" /></div>
    {recipientError && <div className="mono xs err why ferr" role="alert">{recipientError}</div>}
    <div className="amount sm"><input value={amt} onChange={e => { setAmt(e.target.value.replace(/[^\d.]/g, '')); setStage('edit'); setPrep(null) }} inputMode="decimal" placeholder="0" aria-label="Amount" /><span>NEAR</span></div>
    <div className="row"><span className="grow">Network fee (est.)</span><span className="num">{fee ? `${fromUnits(fee, YOCTO, 8)} NEAR` : 'Unavailable'}</span></div>
    {stage === 'edit' || stage === 'preparing' ? <button className="cta" disabled={!units || !to || !!recipientError || stage === 'preparing'} onClick={review}>{stage === 'preparing' ? 'Preparing…' : 'Review send'}</button> : null}
    {(stage === 'review' || stage === 'signing') && <section className="sb">
      <div className="row"><span className="grow">You send</span><span className="num">{amt} NEAR</span></div>
      <div className="row"><span className="grow">To</span><span className="num mono xs">{to.trim()}</span></div>
      <div className="mono xs dim">NEAR Auth will ask you to approve this exact transfer. Spending limits are checked in ORI right before. Transfers can’t be reversed.</div>
      <button className="cta" disabled={stage === 'signing'} onClick={sign}>{stage === 'signing' ? 'Waiting for NEAR Auth…' : 'Approve with NEAR Auth'}</button>
      <button className="ghost" onClick={() => { setStage('edit'); setPrep(null) }}>Edit</button></section>}
    {stage === 'done' && res && <section className="sb"><div className="row"><span className="grow">Status</span><span className="num">{res.status === 'confirmed' ? 'Confirmed' : res.status === 'failed' ? 'Failed on-chain' : 'Submitted · not confirmed yet'}</span></div>
      {res.hash && <div className="row"><span className="grow">Transaction</span><a className="num mono xs" href={`${NEAR_AUTH.explorer}/txns/${res.hash}`} target="_blank" rel="noreferrer">{res.hash.slice(0, 10)}…</a></div>}</section>}
    {err && <div className="mono xs err why" role="alert">{err}</div>}
  </>
}
