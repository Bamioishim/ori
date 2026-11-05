import { useEffect, useState } from 'react'
import { ASSETS, balanceOf, estimateFee, findAsset, fromUnits, preSignCheck, sendEvm, sendSol, toUnits, unsupportedReason, validateRecipient, type FeeEstimate, type EvmProvider, type SolProvider } from './transfers'
import { useManagedWallets } from './wallets'
import { logTransaction, updateTransaction } from './transactions'
import { addSpent, spentToday, type Settings } from './settings'
import { price as priceOf, short, tokens } from './live'

type Stage = 'edit' | 'review' | 'signing' | 'done'
export function SendScreen({ cfg, preset, openWallets }: { cfg: Settings; preset?: { sym: string; net: string } | null; openWallets: () => void }) {
  const [px, setPx] = useState<number | null>(null)
  const { list } = useManagedWallets()
  const [key, setKey] = useState(preset ? `${preset.sym}|${preset.net}` : 'USDC|Base')
  const [sym, net] = key.split('|'); const a = findAsset(sym, net)
  const chain = a?.net === 'Solana' ? 'sol' : a && a.net !== 'NEAR' ? 'evm' : null
  const from = list.find(w => w.chain === chain)?.address || ''
  const [to, setTo] = useState(''); const [amt, setAmt] = useState('')
  const [fee, setFee] = useState<FeeEstimate | null>(null); const [feeErr, setFeeErr] = useState('')
  const [stage, setStage] = useState<Stage>('edit'); const [err, setErr] = useState(''); const [res, setRes] = useState<{ status: string; explorer: string; hash: string } | null>(null)
  const units = a ? toUnits(amt, a.decimals) : null
  const recipientError = a ? (to ? validateRecipient(a.net, to) : null) : null
  const blocked = unsupportedReason(a)
  useEffect(() => { setPx(null); if (!a) return; let dead = false; tokens().then(ts => { if (!dead) { const v = priceOf(ts, a.sym, a.net.toLowerCase() === 'ethereum' ? 'eth' : a.net.toLowerCase() === 'solana' ? 'sol' : a.net.toLowerCase()); setPx(v > 0 ? v : null) } }).catch(() => !dead && setPx(null)); return () => { dead = true } }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const usd = units && a && px ? Number(fromUnits(units, a.decimals, a.decimals)) * px : 0
  useEffect(() => { setFee(null); setFeeErr(''); if (!a || blocked || !from || !units || !to || recipientError) return; let dead = false
    estimateFee(a, from, to.trim(), units).then(f => !dead && setFee(f)).catch(e => !dead && setFeeErr(`Fee estimate unavailable: ${(e as Error).message}`)); return () => { dead = true } }, [key, from, to, amt]) // eslint-disable-line react-hooks/exhaustive-deps
  const paste = async () => { try { setTo((await navigator.clipboard.readText()).trim()) } catch { setErr('Clipboard access was blocked. Paste into the field instead.') } }
  const sign = async () => {
    if (!a || !units || !fee) return; setErr(''); setStage('signing')
    try {
      if (!(usd > 0)) { setErr('No live USD price for this asset, so ORI cannot check your spending limits. Nothing was sent.'); setStage('review'); return }
      const bal = await balanceOf(a, from)
      const why = preSignCheck({ a, units, fee, bal, usd, caps: cfg, spent: spentToday(), recipientError: validateRecipient(a.net, to) })
      if (why) { setErr(why); setStage('review'); return }
      const w = window as unknown as { ethereum?: EvmProvider; solana?: SolProvider }
      const tx = logTransaction({ kind: 'send', status: 'submitted', amount: `-${amt}`, asset: a.sym, network: a.net, to: to.trim(), note: 'Waiting for your wallet signature' })
      let r
      if (a.net === 'Solana') { if (!w.solana?.signAndSendTransaction) throw new Error('No Solana wallet that can sign was found.'); r = await sendSol(w.solana, from, to.trim(), units) }
      else { if (!w.ethereum) throw new Error('No EVM wallet found.'); r = await sendEvm(w.ethereum, a, from, to.trim(), units) }
      updateTransaction(tx.id, { status: r.status === 'confirmed' ? 'completed' : r.status === 'failed' ? 'failed' : 'pending', txHash: r.hash, explorer: r.explorer, note: r.status === 'confirmed' ? 'Confirmed on-chain' : r.status === 'failed' ? 'Transaction reverted on-chain' : 'Submitted; not confirmed yet' })
      if (r.status !== 'failed') addSpent(usd)
      setRes(r); setStage('done')
    } catch (e) { setErr((e as Error).message || 'The wallet did not sign. Nothing was sent.'); setStage('review') }
  }
  const options = ASSETS.map(x => `${x.sym}|${x.net}`)
  return <div className="pg">
    <section className="pad-top"><h2 className="big2">Send<br /><span className="dim">to any wallet address.</span></h2>
      <div className="mono xs dim">Same-network transfer from your own wallet. No ORI account needed on the other side, and no cross-chain route.</div></section>
    <section>
      <div className="row"><span className="grow">Asset · network</span><select className="history-filter" value={key} onChange={e => { setKey(e.target.value); setStage('edit') }} aria-label="Asset and network">{options.map(o => <option key={o} value={o}>{o.replace('|', ' · ')}{unsupportedReason(findAsset(o.split('|')[0], o.split('|')[1])) ? ' (unavailable)' : ''}</option>)}</select></div>
      {blocked ? <div className="mono xs err why">{blocked}</div>
        : !from ? <><div className="mono xs dim why">Connect a {chain === 'sol' ? 'Solana' : 'EVM'} wallet to send {a?.sym} on {a?.net}.</div><button className="ghost" onClick={openWallets}>Connect a wallet</button></>
        : <>
          <div className="row"><span className="grow">From<br /><span className="mono xs dim">{short(from)} · your wallet signs</span></span></div>
          <div className="row"><input className="field" value={to} onChange={e => { setTo(e.target.value); setStage('edit') }} placeholder={`${a?.net} address`} aria-label="Recipient address" spellCheck={false} autoComplete="off" /><button className="ghost" onClick={paste}>Paste</button></div>
          {recipientError && <div className="mono xs err why">{recipientError}</div>}
          <div className="amount sm"><input value={amt} onChange={e => { setAmt(e.target.value.replace(/[^\d.]/g, '')); setStage('edit') }} inputMode="decimal" placeholder="0" aria-label="Amount" /><span>{a?.sym}</span></div>
          {amt && !units && <div className="mono xs err why">Enter a positive amount with at most {a?.decimals} decimals.</div>}
          <div className="row"><span className="grow">Network fee</span><span className="num">{fee ? `${fromUnits(fee.feeUnits, fee.feeDecimals, 8)} ${fee.feeSym}` : feeErr ? 'Unavailable' : units && to && !recipientError ? 'Estimating…' : '—'}</span></div>
          {fee && <div className="mono xs dim">{fee.detail}. ORI adds no fee.</div>}{feeErr && <div className="mono xs err why">{feeErr}</div>}
        </>}
    </section>
    {!blocked && from && stage === 'edit' && <button className="cta" disabled={!units || !to || !!recipientError || !fee} onClick={() => setStage('review')}>Review send</button>}
    {(stage === 'review' || stage === 'signing') && a && units && fee && <section className="sb"><div className="row"><span className="grow">You send</span><span className="num">{amt} {a.sym} on {a.net}</span></div>
      <div className="row"><span className="grow">To</span><span className="num mono xs">{short(to.trim())}</span></div>
      <div className="row"><span className="grow">Network fee (est.)</span><span className="num">{fromUnits(fee.feeUnits, fee.feeDecimals, 8)} {fee.feeSym}</span></div>
      <div className="mono xs dim">Your balance and spending limits are checked again right before your wallet asks you to sign. Transfers can’t be reversed.</div>
      {err && <div className="mono xs err why">{err}</div>}
      <button className="cta" disabled={stage === 'signing'} onClick={sign}>{stage === 'signing' ? 'Waiting for wallet…' : 'Sign in wallet'}</button>
      <button className="ghost" onClick={() => setStage('edit')}>Edit</button></section>}
    {stage === 'done' && res && <section className="sb"><div className="row"><span className="grow">Status</span><span className="num">{res.status === 'confirmed' ? 'Confirmed' : res.status === 'failed' ? 'Failed on-chain' : 'Submitted · not confirmed yet'}</span></div>
      <div className="row"><span className="grow">Transaction</span><a className="num mono xs" href={res.explorer} target="_blank" rel="noreferrer">{short(res.hash)}</a></div></section>}
  </div>
}
