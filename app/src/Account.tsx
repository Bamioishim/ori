import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export type Account = { user_id: string; email: string; username: string; recovery_code: string; createdAt: number }

type Props = { open: boolean; guestId: string; account: Account | null; onClose: () => void; onSignedIn: (account: Account | null) => void }
const USERNAME = /^[a-z][a-z0-9_]{2,19}$/i
const makeId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}_${Math.random().toString(36).slice(2)}`

export default function AccountSheet({ open, guestId, account, onClose, onSignedIn }: Props) {
  const [step, setStep] = useState<'start' | 'profile'>('start')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const available = useMemo(() => {
    const taken = JSON.parse(localStorage.getItem('ori-usernames') || '[]') as string[]
    return USERNAME.test(username) && !taken.includes(username.trim().toLowerCase())
  }, [username])
  const reset = () => { setStep('start'); setEmail(''); setUsername(''); setCode(''); setError(''); setSaved(false) }
  const close = () => { reset(); onClose() }
  const begin = () => {
    const v = email.trim().toLowerCase()
    if (!/^[^\s@]+@gmail\.com$/.test(v)) { setError('Use a Gmail address for authentication and recovery.'); return }
    setError(''); setStep('profile')
  }
  const save = () => {
    const u = username.trim().toLowerCase()
    if (!available) { setError('Choose an available username: 3–20 letters, numbers, or underscores.'); return }
    if (!/^\d{4}$/.test(code)) { setError('Save a 4-digit recovery code.'); return }
    const a: Account = { user_id: makeId(), email: email.trim().toLowerCase(), username: u, recovery_code: code, createdAt: Date.now() }
    const taken = JSON.parse(localStorage.getItem('ori-usernames') || '[]') as string[]
    localStorage.setItem('ori-usernames', JSON.stringify([...new Set([...taken, u])]))
    localStorage.setItem('ori-account', JSON.stringify(a)); onSignedIn(a); setSaved(true)
  }
  return <AnimatePresence>{open && <>
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
    <motion.div className="account-sheet" initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} role="dialog" aria-label="ORI account">
      <div className="sheet-head"><div><div className="label">ACCOUNT · {account ? 'SIGNED IN' : 'GUEST SESSION'}</div><h2 className="big2">{account ? `@${account.username}` : 'Keep your ORI'}</h2></div><button className="mono xs dim" onClick={close}>CLOSE</button></div>
      {account ? <>
        <div className="account-card"><span className="account-dot" /><div><b>Signed in with Gmail</b><span className="sub">{account.email}</span></div></div>
        <div className="mono xs dim why">Your internal identity is <b>{account.user_id}</b>. Your username is public-facing only. Saved conversations and memory stay tied to the internal account ID.</div>
        <button className="ghost" onClick={() => { localStorage.removeItem('ori-account'); onSignedIn(null); close() }}>Sign out</button>
      </> : step === 'start' ? <>
        <p className="account-copy">You’re browsing as a guest. This session is limited to this device. Sign in when you want saved conversations, persistent memory, or a portable profile.</p>
        <div className="guest-id mono xs">GUEST SESSION · {guestId.slice(0, 12)}…</div>
        <button className="cta" onClick={() => setStep('profile')}>Continue with Gmail</button>
        <div className="mono xs dim why">Gmail is the intended authentication and recovery identity. This preview stores the profile locally until Google OAuth is connected. ORI does not use usernames as the primary identity.</div>
      </> : saved ? <>
        <div className="account-success"><b>Account saved.</b><span className="sub">Your conversations can now persist to this profile.</span></div>
        <button className="cta" onClick={close}>Done</button>
      </> : <>
        <div className="account-copy">Use Gmail for authentication and recovery. Pick a public username, then save a 4-digit recovery code.</div>
        <label className="account-label">GMAIL ADDRESS<input className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" /></label>
        <label className="account-label">PUBLIC USERNAME<input className="field" value={username} onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))} placeholder="tolu" autoComplete="username" /></label>
        {username && <div className={'mono xs availability ' + (available ? 'ok' : 'bad')}>{available ? `@${username.toLowerCase()} is available` : 'Username is unavailable or invalid'}</div>}
        <label className="account-label">4-DIGIT RECOVERY CODE<input className="field" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="••••" autoComplete="off" /></label>
        {error && <div className="mono xs err why">{error}</div>}
        <div className="rowbtns"><button className="ghost" onClick={() => setStep('start')}>Back</button><button className="cta compact" onClick={email ? save : begin}>{email ? 'Save account' : 'Continue'}</button></div>
      </>}
    </motion.div>
  </>}</AnimatePresence>
}
