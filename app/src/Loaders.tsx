import { motion } from 'motion/react'
const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
// Three dots, sequential sine-wave scale pulse left -> middle -> right, looping.
export function Dots({ size = 6, label = 'Loading' }: { size?: number; label?: string }) {
  return <span className="dots" role="status" aria-label={label}>{[0, 1, 2].map(i =>
    <motion.i key={i} style={{ width: size, height: size }}
      animate={reduce ? { opacity: [0.4, 1, 0.4] } : { scale: [0.55, 1.15, 0.55], opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }} />)}</span>
}
// Thick checkmark that pops in with spring overshoot.
export function Check({ size = 28 }: { size?: number }) {
  return <motion.svg viewBox="0 0 24 24" width={size} height={size} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 13 }} aria-label="Done">
    <motion.path d="M4.5 12.5l5 5L19.5 7" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: 'easeOut' }} /></motion.svg>
}
