import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { LogoStack } from './Logo'
export type Stage = 'black' | 'mark' | 'land' | 'done'
// Opening: black hold -> wordmark + subtitle -> wordmark glides into header (shared layoutId) while a dark curved sheet sweeps up.
export function useIntro(): [Stage, () => void] {
  const q = new URLSearchParams(location.search)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const play = q.get('intro') === '1' || (!sessionStorage.getItem('ori-intro') && q.get('intro') !== '0' && !reduce)
  const freeze = q.get('stage') as Stage | null // for screenshots
  const [stage, setStage] = useState<Stage>(freeze || (play ? 'mark' : 'done')) // start on the wordmark, never a blank black frame
  useEffect(() => {
    if (freeze || stage === 'done') return
    sessionStorage.setItem('ori-intro', '1')
    const to = (n: Stage) => () => setStage(s => s === 'done' ? s : n)
    const t1 = setTimeout(to('mark'), 1450), t2 = setTimeout(to('land'), 1450 + 1500), t3 = setTimeout(to('done'), 1450 + 1500 + 900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])
  return [stage, () => { sessionStorage.setItem('ori-intro', '1'); setStage('done') }]
}
export default function Intro({ stage, skip }: { stage: Stage; skip: () => void }) {
  return <AnimatePresence>{stage !== 'done' && <motion.div className="intro" onClick={skip} exit={{ opacity: 0, transition: { duration: 0.3 } }}
    animate={{ backgroundColor: stage === 'land' ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)' }} transition={{ duration: 0.5, delay: stage === 'land' ? 0.35 : 0 }}>
    {stage === 'mark' && <div className="intro-c">
      <motion.span layoutId="wordmark" className="intro-logo" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}><LogoStack size={150} /></motion.span>
      <motion.p className="intro-sub" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }}>All your money in one place</motion.p>
    </div>}
    {stage === 'land' && <motion.div className="intro-sheet" initial={{ y: '100%' }} animate={{ y: '-115%' }} transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1] }} />}
    <span className="intro-skip mono xs">TAP TO SKIP</span>
  </motion.div>}</AnimatePresence>
}
