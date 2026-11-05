// ORI micro-interactions. Original implementations of generic patterns (slide-to-confirm, copy check, masked
// balance, price digit flow, spring tabs, OTP, inline field errors). No third-party component code is included.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { copyText, flowParts, sanitizeOtp, SLIDE_IDLE, slideStep, type SlideEvent } from './uiLogic'


export function SlideConfirm({ label, disabled, onConfirm }: { label: string; disabled: boolean; onConfirm: () => void }) {
  const [st, setSt] = useState(SLIDE_IDLE); const stRef = useRef(SLIDE_IDLE)
  const track = useRef<HTMLDivElement>(null); const grab = useRef<number | null>(null); const armT = useRef(0)
  const reduce = useReducedMotion()
  const fire = useRef(onConfirm); useEffect(() => { fire.current = onConfirm }, [onConfirm])
  const send = (e: SlideEvent) => { const r = slideStep(stRef.current, e, disabled); stRef.current = r.s; setSt(r.s); if (r.fire) { navigator.vibrate?.([18, 40, 18]); fire.current() } return r.s }
  useEffect(() => { if (disabled && stRef.current.phase !== 'done') { stRef.current = SLIDE_IDLE; setSt(SLIDE_IDLE) } }, [disabled])
  useEffect(() => () => clearTimeout(armT.current), [])
  const geom = () => { const t = track.current!.getBoundingClientRect(); const knob = 48; return { left: t.left, travel: Math.max(1, t.width - knob - 8) } }
  const onDown = (e: React.PointerEvent) => { if (disabled) return; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); grab.current = null; send({ t: 'down' }) }
  const onMove = (e: React.PointerEvent) => {
    if (stRef.current.phase !== 'drag') return
    const g = geom(), at = e.clientX - g.left
    if (grab.current === null) { grab.current = at - stRef.current.frac * g.travel; return } // offset taken at first move: no jump
    send({ t: 'move', frac: (at - grab.current) / g.travel })
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { send({ t: 'cancel' }); return }
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault(); const s = send({ t: 'key', repeat: e.repeat })
    clearTimeout(armT.current); if (s.phase === 'armed') armT.current = window.setTimeout(() => send({ t: 'timeout' }), 5000)
  }
  const hint = disabled ? label : st.phase === 'armed' ? 'Release, then press Enter again to confirm · Esc cancels' : st.phase === 'done' ? 'Confirmed' : label
  return <div ref={track} className={'slide' + (disabled ? ' off' : '') + (st.phase === 'armed' ? ' armed' : '') + (st.phase === 'done' ? ' done' : '')}
    role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={disabled ? label : `${label}. Slide the handle all the way right, or press Enter twice.`}
    onKeyDown={onKey} onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') send({ t: 'keyup' }) }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => send({ t: 'up' })} onPointerCancel={() => send({ t: 'cancel' })} onLostPointerCapture={() => send({ t: 'up' })} onContextMenu={e => e.preventDefault()}>
    <span className={'slide-fill' + (st.phase === 'drag' || reduce ? '' : ' ease')} style={{ width: `calc(52px + (100% - 56px) * ${st.frac})` }} />
    <span className="slide-label" aria-live="polite">{hint}</span>
    <span className={'slide-knob' + (st.phase === 'drag' || reduce ? '' : ' ease')} aria-hidden style={{ left: `calc(4px + (100% - 56px) * ${st.frac})` }}>{st.phase === 'done' ? '✓' : '→'}</span>
  </div>
}

function CopyGlyph({ ok }: { ok: boolean }) {
  return <svg className={'cglyph' + (ok ? ' ok' : '')} width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
    {ok ? <path className="ck" d="M2.5 7.5l3 3 6-7" /> : <><rect x="4.5" y="4.5" width="7" height="7" rx="1.5" /><path d="M9.5 2.5h-5a2 2 0 0 0-2 2v5" /></>}</svg>
}
export function CopyButton({ text, label = 'Copy', className = 'ghost', aria }: { text: string; label?: string; className?: string; aria?: string }) {
  const [st, setSt] = useState<'idle' | 'ok' | 'fail'>('idle'); const t = useRef(0)
  useEffect(() => () => clearTimeout(t.current), [])
  const go = async () => { const ok = await copyText(text); setSt(ok ? 'ok' : 'fail'); clearTimeout(t.current); t.current = window.setTimeout(() => setSt('idle'), 1600) }
  return <button type="button" className={className + ' copybtn' + (st === 'ok' ? ' copied' : st === 'fail' ? ' cfail' : '')} onClick={go} aria-label={aria}>
    <CopyGlyph ok={st === 'ok'} /><span aria-live="polite">{st === 'ok' ? 'Copied' : st === 'fail' ? 'Copy failed · select it' : label}</span></button>
}

export function PriceFlow({ text, className = 'num' }: { text: string; className?: string }) {
  const reduce = useReducedMotion()
  const [pair, setPair] = useState<{ prev: string | null; cur: string }>({ prev: null, cur: text })
  if (pair.cur !== text) setPair({ prev: pair.cur, cur: text }) // derive "previous value" during render, no ref reads
  const parts = flowParts(pair.cur === text ? pair.prev : pair.cur, text)
  return <span className={className + ' pflow'} aria-label={text}>{parts.map((p, i) => p.changed && !reduce
    ? <motion.span key={i + p.ch + text} aria-hidden initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: .28, delay: i * .015 }}>{p.ch}</motion.span>
    : <span key={i} aria-hidden>{p.ch}</span>)}</span>
}

export function PillTabs<T extends string | number>({ value, options, onChange, id, role = 'tablist', className = '' }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void; id: string; role?: 'tablist' | 'radiogroup'; className?: string }) {
  const reduce = useReducedMotion(); const item = role === 'tablist' ? 'tab' : 'radio'
  const keys = (e: React.KeyboardEvent, i: number) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); onChange(options[(i + d + options.length) % options.length][0]) }
  return <div className={'ptabs ' + className} role={role}>{options.map(([k, l], i) => {
    const on = k === value
    return <button key={String(k)} type="button" role={item} aria-selected={item === 'tab' ? on : undefined} aria-checked={item === 'radio' ? on : undefined} tabIndex={on ? 0 : -1} className={on ? 'on' : ''} onClick={() => onChange(k)} onKeyDown={e => keys(e, i)}>
      {on && <motion.i layoutId={'pt-' + id} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 26, mass: .8 }} />}<span>{l}</span></button>
  })}</div>
}

export function FieldError({ id, msg }: { id: string; msg: string | null | false | undefined }) {
  return msg ? <div id={id} className="mono xs err why ferr" role="alert">{msg}</div> : null
}

export function OtpInput({ value, onChange, length = 6, label }: { value: string; onChange: (v: string) => void; length?: number; label: string }) {
  const [focus, setFocus] = useState(false)
  return <span className="otp">
    <input className="otp-in" value={value} aria-label={label} inputMode="numeric" autoComplete="one-time-code" pattern="\d*" maxLength={length}
      onChange={e => onChange(sanitizeOtp(e.target.value, length))} onPaste={e => { e.preventDefault(); onChange(sanitizeOtp(e.clipboardData.getData('text'), length)) }} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
    <span className="otp-boxes" aria-hidden>{Array.from({ length }, (_, i) => <span key={i} className={'otp-b' + (value[i] ? ' fill' : '') + (focus && i === Math.min(value.length, length - 1) ? ' cur' : '')}>{value[i] || ''}</span>)}</span>
  </span>
}

