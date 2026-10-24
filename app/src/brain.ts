import { DEMO_ADDRS } from './mock'
// Ori's local intent engine. Rule-based, no LLM, no API keys. Answers from live app state,
// live 1Click prices / dry quotes, live GoPlus checks, and a small built-in knowledge base.
// It never moves money: actions are proposals the user confirms in the UI.
import { ASSET, PREVIEW, goplus, kindOf, quote, short, tokens } from './live'
import { APPROVALS, SUSPICIOUS, blockedLog, feed, revoked, usd, type Settings } from './settings'

export type Act =
  | { k: 'pay'; to: string; amt: string }
  | { k: 'swap'; amt: string; flip: boolean }
  | { k: 'go'; screen: string }
  | { k: 'mode'; m: 'example' | 'live' }
  | { k: 'hide'; v: boolean }
  | { k: 'set'; patch: Partial<Settings>; label: string }
  | { k: 'trust'; who: string }
export type Reply = { text: string; act?: Act; confirm?: boolean; chips?: string[]; mood?: 'happy' | 'worried' | 'think' }
export type Ctx = { mode: 'example' | 'live'; hidden: boolean; rows: { sym: string; chain: string; amt: number; usd: number }[]; settings: Settings; spent: number }

const N: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 }
const num = (s?: string) => !s ? NaN : isNaN(+s.replace(/,/g, '')) ? (N[s] ?? NaN) : +s.replace(/,/g, '')
const CHAINS: Record<string, string> = { base: 'Base', solana: 'Solana', sol: 'Solana', ethereum: 'Ethereum', eth: 'Ethereum', mainnet: 'Ethereum', near: 'NEAR' }
const SYMS = ['USDC', 'USDT', 'SOL', 'ETH', 'NEAR', 'BTC', 'WBTC']
const PRICE_CHAIN: Record<string, string> = { SOL: 'sol', ETH: 'eth', NEAR: 'near', BTC: 'btc', USDC: 'base', USDT: 'eth', WBTC: 'eth' }
const DEFAULT_CHIPS = ['What’s my balance?', 'What are my limits?', 'Anything flagged?', 'Swap 1 SOL to USDC']

const KB: [RegExp, string, string[]?][] = [
  [/what(’|')?s ori|what is ori|about (ori|this app)|what does (ori|this app) do/, 'ORI is one balance for all your money across Base, Ethereum, Solana and NEAR. You pay or swap from that one balance, and ORI picks the route. In this preview the data is example or watch-only, and payments are simulated.', ['How does NEAR Intents work?', 'What’s live in this preview?']],
  [/intent|route|routing|1click|solver/, 'NEAR Intents: you state the outcome you want, like “50 USDC arrives on Solana”, and solvers compete to fill it. ORI asks 1Click for a dry-run quote, so you see the fee, the minimum out and the ETA before anything happens. In this preview nothing is ever submitted.', ['How much to send $50 to Solana?']],
  [/safe|scam|drain|secure|trust (ori|this)/, 'Safety checks: every recipient goes through a live GoPlus address check, and flagged addresses are blocked. Your spending caps are enforced, and anything above your hold threshold needs a press-and-hold. This preview has no keys and signs nothing.', ['Check an address', 'Open security']],
  [/yield|earn|apy|interest/, 'Yield Guard: only idle stablecoins above your liquid floor go into blue-chip lending (Aave, Kamino, Rhea), with per-protocol caps. It auto-exits on a depeg or a sharp TVL drop. In this preview the Earn numbers are example data.', ['Open earn']],
  [/privacy|private|hidden|track|explorer/, 'Privacy: each chain address is derived separately, so there’s no public link between them. Incoming payments use fresh addresses, and the AI reasoning is designed to run in confidential compute. You can also hide your balance on screen anytime.', ['Hide my balance', 'Open privacy']],
  [/chain signature/, 'Chain Signatures let one NEAR account control addresses on other chains through MPC signing. That’s how ORI can hold Base, Ethereum and Solana from a single account. Nothing is signed in this preview.'],
  [/fee|cost|cheap/, 'Fees come straight from the live solver quote. For a stablecoin hop like Base USDC to Solana USDC they’re usually cents. Ask me for a quote and I’ll show you the exact number.', ['How much to send $50 to Solana?']],
  [/live|simulat|real|fake|preview|demo/, 'What’s live in this preview: prices and dry-run quotes from 1Click, GoPlus scam checks, and watch-only balances read from public RPCs. Simulated: payments, swaps, yield, and handle-to-address lookup. Nothing is signed or sent.', ['Open help']],
  [/wallet|key|seed|sign up|account|login/, 'This preview has no wallet, keys or login. You can add public addresses in Settings to watch real balances, read-only.', ['Open settings']],
  [/what can you do|help me|commands|how do i use/, 'I can read your balance, quote prices, prep a payment or swap for you to confirm, check any address for scams, change your limits, and explain how ORI works. Try one of these:', DEFAULT_CHIPS],
]
const TALK: [RegExp, string[]][] = [
  [/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/, ['Hey. What can I do for you?', 'Hi! Ask me about your balance, prices, or tell me to pay someone.']],
  [/how are you|how(’|')?s it going/, ['Running smoothly and watching your balance. You?', 'All good. No scams spotted today.']],
  [/who are you|your name|what are you/, ['I’m Ori, ORI’s courier. I carry your payments across chains, and I check every address first.']],
  [/thank|thanks|cheers|nice|great|cool/, ['Anytime.', 'Happy to help.']],
  [/joke/, ['Why did the stablecoin go to therapy? It kept getting attached.', 'I tried to bridge my feelings once. The fee was too high.']],
  [/bye|good night|see you/, ['See you. I’ll keep an eye on things.']],
  [/love you|you(’|')?re (cute|great|awesome)/, ['That’s kind. I’ll deliver extra carefully today.']],
]
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

async function priceOf(sym: string) {
  const ts = await tokens(); const c = PRICE_CHAIN[sym]
  return ts.find(t => t.symbol === sym && t.blockchain === c) ?? ts.find(t => t.symbol === sym) ?? (sym === 'BTC' ? ts.find(t => t.symbol === 'BTC' || t.symbol === 'WBTC') : undefined)
}

export async function answer(raw: string, ctx: Ctx): Promise<Reply> {
  const t = raw.toLowerCase().replace(/[?!.]+$/, '').trim()
  const S = (s: string) => SYMS.find(x => new RegExp('\\b' + x.toLowerCase() + '\\b').test(s))
  if (!t) return { text: 'Say something and I’ll do my best.', chips: DEFAULT_CHIPS }

  // my own addresses (demo)
  if (/\b(my|our)\b.*\b(address|account( id)?|wallet)\b|\bwhere (do|can) (i|people) (send|receive)|\breceive address/.test(t) && !/0x[0-9a-f]{6}/.test(t)) {
    const ch = /sol/.test(t) ? 'Solana' : /near/.test(t) ? 'NEAR' : /base/.test(t) ? 'Base' : /eth/.test(t) ? 'Ethereum' : null
    const list = ch ? DEMO_ADDRS.filter(a => a.chain === ch) : DEMO_ADDRS
    return { text: (ch ? `Your ${ch} address is ${list[0].addr}` : 'Your addresses: ' + list.map(a => `${a.chain} ${a.addr}`).join(' · ')) + '. Example data: these are demo addresses, so don’t send real funds to them. All of them feed one balance.', chips: ['Open profile', 'What’s my balance?'] }
  }
  // address check
  const addr = raw.match(/0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}|\b[a-z0-9_-]+\.near\b/)
  if (addr && (/check|scan|safe|scam|is this|address/.test(t) || t === addr[0].toLowerCase())) {
    const a = addr[0], k = kindOf(a)
    if (k !== 'evm') return { text: `${short(a)} is a ${k === 'sol' ? 'Solana' : k === 'near' ? 'NEAR' : 'non-EVM'} address. GoPlus address checks here cover EVM chains only, so I can’t vouch for it. Treat it with care.`, mood: 'think' }
    try { const r = await goplus(a)
      if (r.state === 'flagged') return { text: `Careful: GoPlus flags ${short(a)} for ${r.flags.join(', ')}. I would block a payment to it.`, mood: 'worried', chips: ['Open security'] }
      if (r.state === 'clean') return { text: `GoPlus has no flags on ${short(a)}, checked live just now. That isn’t a guarantee, but nothing known is bad.`, mood: 'happy' }
      return { text: `I couldn’t reach GoPlus just now (${r.source}). Treat ${short(a)} as unverified.`, mood: 'think' }
    } catch { return { text: 'GoPlus is unreachable right now. Treat that address as unverified.', mood: 'think' } }
  }
  // settings via chat (needs confirm)
  let m = t.match(/(daily|per[- ]?payment|per pay|hold)[a-z\s-]*?(?:limit|cap|threshold|above|to)?\s*(?:to|at|=)?\s*\$?\s*([\d,.]+)/)
  if (m && /set|change|make|limit|cap|threshold|raise|lower/.test(t)) {
    const v = num(m[2]); const key = m[1].startsWith('daily') ? 'daily' : m[1].startsWith('hold') ? 'holdAbove' : 'perPay'
    const label = key === 'daily' ? 'daily cap' : key === 'holdAbove' ? 'hold-to-confirm threshold' : 'per-payment cap'
    if (!(v >= 0)) return { text: 'What amount should the limit be?' }
    return { text: `Set your ${label} to ${usd(v)}? Confirm below.`, act: { k: 'set', patch: { [key]: v } as Partial<Settings>, label }, confirm: true }
  }
  if (/(turn on|switch to|use|show) (the )?example/.test(t)) return { text: 'Switch to example data?', act: { k: 'mode', m: 'example' }, confirm: true }
  if (/(turn on|switch to|use|go) (the )?(live|watch)/.test(t)) return { text: 'Switch to watch-only live data? I’ll read the addresses you’ve added in Settings.', act: { k: 'mode', m: 'live' }, confirm: true }
  if (/\b(hide|blur)\b.*balance|^hide$/.test(t)) return { text: 'Hidden. I’m not looking.', act: { k: 'hide', v: true } }
  if (/\b(show|unhide|reveal)\b.*balance|^show$/.test(t)) return { text: 'Back on.', act: { k: 'hide', v: false } }
  if (/(voice|speech|talking) off|mute|stop talking|be quiet/.test(t)) return { text: 'Voice off. I’ll stick to text.', act: { k: 'set', patch: { voice: false }, label: 'voice' } }
  if (/(voice|speech) on|unmute|talk to me/.test(t)) return { text: 'Voice on.', act: { k: 'set', patch: { voice: true }, label: 'voice' } }
  m = t.match(/trust\s+(@?[\w.-]+)/); if (m) { const w = m[1].startsWith('@') ? m[1] : '@' + m[1]; return { text: `Add ${w} to trusted contacts?`, act: { k: 'trust', who: w }, confirm: true } }
  // policy, blocks, flags
  if (/(open|go to|show|take me to).*(polic|limit|allowlist|cap)/.test(t)) return { text: 'Opening Policy & limits.', act: { k: 'go', screen: 'policy' } }
  if (/(open|go to|show|take me to|run|start).*(scan|approval|revoke)/.test(t)) return { text: 'Opening the scam & approval scanner.', act: { k: 'go', screen: 'scan' } }
  if (/(my )?(limits?|caps?|policy|threshold|allowlist|spending rules)\b/.test(t) && !/set|change|raise|lower/.test(t)) {
    const c = ctx.settings, left = Math.max(0, c.daily - ctx.spent)
    return { text: `Your policy: daily cap ${usd(c.daily)} (${usd(left)} left today), per-transaction cap ${usd(c.perPay)}, and anything above ${usd(c.holdAbove)} needs a hold to confirm. Allowlist: ${c.trusted.join(', ') || 'empty'}. Sends to anyone else get flagged.`, chips: ['Open policy', 'What did you block?', 'Set daily cap to 300'] }
  }
  if (/block|stopp|denied|rejected/.test(t)) {
    const b = blockedLog()
    if (!b.length) { const d = feed().find(f => f.kind === 'block'); return { text: `Nothing real blocked on this device yet.${d ? ` From the demo feed: ${d.text.toLowerCase()} (${d.sub}).` : ''} Try paying more than your per-transaction cap and I’ll stop it.`, chips: ['What are my limits?', 'Pay kemi 400'] } }
    return { text: `I’ve blocked ${b.length} attempt${b.length > 1 ? 's' : ''}. Latest: ${b[0].what}. ${b[0].why}`, mood: 'worried', chips: ['Open policy', 'Open security'] }
  }
  if (/flag|risky|suspicious|approval|revoke|danger|warning/.test(t)) {
    const rv = revoked(), act = APPROVALS.filter(a => !rv.includes(a.id) && a.risk)
    const parts = [...SUSPICIOUS.map(x => `${x.sym} on ${x.chain} looks like a scam token (${x.why.split(' · ')[0].toLowerCase()})`), ...act.map(a => `${a.amount === 'Unlimited' ? 'an unlimited' : 'a'} ${a.token} approval on ${a.chain} to ${a.name}`)]
    return { text: `I’ve flagged ${parts.length} thing${parts.length === 1 ? '' : 's'}: ${parts.join('; ')}. The scanner lets you revoke approvals (demo).`, mood: 'worried', act: { k: 'go', screen: 'scan' }, chips: ['What did you block?'] }
  }
  // navigation
  m = t.match(/\b(open|go to|show me|take me to)\s+(the )?(home|pay|swap|policy|scan|earn|privacy|settings|security|help|profile)\b/)
  if (m) return { text: `Opening ${m[3]}.`, act: { k: 'go', screen: m[3] } }

  // quote: how much to send $X to solana
  m = t.match(/(?:how much|cost|fee|quote).*?(?:send|move|bridge)\s+\$?\s*([\d,.]+)\s*(?:usdc|dollars|usd)?\s+to\s+(solana|sol)\b/) || t.match(/(?:send|move|bridge)\s+\$?\s*([\d,.]+)\s*(?:usdc|dollars|usd)?\s+to\s+(solana)\b.*(?:cost|fee|how much)?/)
  if (m) { const n = num(m[1]); try {
    const q = await quote({ from: ASSET.baseUSDC, to: ASSET.solUSDC, amount: BigInt(Math.round(n * 1e6)), recipient: PREVIEW.sol, refundTo: PREVIEW.evm, outDecimals: 6 })
    return { text: `Live dry quote: send ${usd(n)} of USDC from Base and about ${q.amountOut.toFixed(2)} USDC lands on Solana in about ${q.eta}s. The fee is ${usd(q.fee)}, and the minimum out is ${q.minOut.toFixed(2)}.`, chips: [`Pay tolu ${n} USDC`], mood: 'happy' }
  } catch (e) { return { text: `I couldn’t get a live quote (${(e as Error).message}). Nothing was sent.`, mood: 'think' } } }

  // swap X SOL to USDC
  m = t.match(/(?:swap|convert|exchange|trade)\s+([\d,.]+|[a-z]+)?\s*(sol|usdc|eth|near|usdt|btc)?\s*(?:to|for|into)\s*(sol|usdc|eth|near|usdt|btc)/)
  if (m || /^swap\b/.test(t)) {
    if (!m) return { text: 'Swap is open. Pick an amount.', act: { k: 'swap', amt: '1', flip: false } }
    const n = num(m[1]) || 1, a = (m[2] || (m[3] === 'usdc' ? 'sol' : 'usdc')).toUpperCase(), b = m[3].toUpperCase()
    if (!((a === 'SOL' && b === 'USDC') || (a === 'USDC' && b === 'SOL'))) return { text: `This preview swaps SOL and USDC only. ${a} to ${b} isn’t wired up yet.`, chips: ['Swap 1 SOL to USDC'] }
    let extra = ''
    try { const flip = a === 'USDC'; const q = await quote({ from: flip ? ASSET.baseUSDC : ASSET.SOL, to: flip ? ASSET.SOL : ASSET.baseUSDC, amount: BigInt(Math.round(n * 10 ** (flip ? 6 : 9))), recipient: flip ? PREVIEW.sol : PREVIEW.evm, refundTo: flip ? PREVIEW.evm : PREVIEW.sol, outDecimals: flip ? 9 : 6 })
      extra = ` The live quote is about ${q.amountOut.toLocaleString('en-US', { maximumFractionDigits: flip ? 4 : 2 })} ${b}, with a fee of ${usd(q.fee)}.` } catch { }
    return { text: `Swap card ready: ${n} ${a} to ${b}.${extra} Hold to confirm. It’s simulated.`, act: { k: 'swap', amt: String(n), flip: a === 'USDC' } }
  }
  // pay
  m = t.match(/(?:pay|send|give|transfer)\s+(@?[a-z][\w.@-]*)\s+\$?\s*([\d,.]+|[a-z]+)\s*(?:usdc|usd|dollars|bucks)?/) 
  let to = m?.[1], amt = m?.[2]
  if (!m || isNaN(num(amt)) || /^(to|me)$/.test(to!)) { const m2 = t.match(/(?:pay|send|give|transfer)\s+\$?\s*([\d,.]+|[a-z]+)\s*(?:usdc|usd|dollars|bucks)?\s+to\s+(@?[\w.@+-]+)/); if (m2 && !isNaN(num(m2[1]))) { amt = m2[1]; to = m2[2]; m = m2 } else m = null }
  if (m && to && amt) {
    const n = num(amt); const who = to.startsWith('@') || to.includes('.') || to.startsWith('0x') || /^\+?\d+$/.test(to) ? to : '@' + to
    const over = n > ctx.settings.perPay ? ` Heads up: that’s over your per-payment cap of ${usd(ctx.settings.perPay)}, so I’ll block it.` : n > ctx.settings.daily - ctx.spent ? ` Heads up: that passes your daily cap.` : ''
    return { text: `Payment card ready: ${usd(n)} to ${who}. Check it, then ${n > ctx.settings.holdAbove ? 'hold' : 'tap'} to pay.${over}`, act: { k: 'pay', to: who, amt: String(n) }, mood: over ? 'worried' : undefined }
  }
  // price
  if (/price|worth|how much is|trading at|value of|cost of/.test(t) && S(t)) {
    const sym = S(t)!
    try { const p = await priceOf(sym); if (!p) return { text: `I don’t have a 1Click price for ${sym}.` }
      return { text: `${sym} is ${p.price.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: p.price < 10 ? 4 : 2 })} right now (live 1Click feed, updated ${new Date(p.priceUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}).`, chips: sym === 'SOL' ? ['Swap 1 SOL to USDC', 'Price of ETH'] : ['Price of SOL', 'Price of NEAR'] }
    } catch (e) { return { text: `The price feed isn’t responding (${(e as Error).message}). I won’t guess.`, mood: 'think' } }
  }
  // balances
  if (/balance|how much|what do i have|holdings|portfolio|net worth|my money|total/.test(t)) {
    const src = ctx.mode === 'live' ? 'live, read-only' : 'example data'
    if (ctx.mode === 'live' && !ctx.rows.length) return { text: 'No watched balances yet. Add a public address in Settings and I’ll read it live.', chips: ['Open settings'] }
    const sym = S(t); const ch = Object.keys(CHAINS).find(c => new RegExp('\\bon ' + c + '\\b|\\b' + c + ' (chain|network)\\b').test(t))
    let rows = ctx.rows
    if (sym) rows = rows.filter(r => r.sym === sym)
    if (ch) rows = rows.filter(r => r.chain === CHAINS[ch])
    const tot = rows.reduce((a, r) => a + r.usd, 0), units = rows.reduce((a, r) => a + r.amt, 0)
    const hid = ctx.hidden ? ' Your balance is hidden on screen, but you asked, so here it is.' : ''
    if (sym || ch) {
      if (!rows.length) return { text: `You don’t hold ${sym ?? 'anything'}${ch ? ' on ' + CHAINS[ch] : ''} (${src}).` }
      return { text: `${sym ? units.toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' ' + sym : 'Holdings'}${ch ? ' on ' + CHAINS[ch] : ''}: ${usd(tot)} (${src}).${hid}` }
    }
    const byChain: Record<string, number> = {}; ctx.rows.forEach(r => byChain[r.chain] = (byChain[r.chain] || 0) + r.usd)
    const top = Object.entries(byChain).sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c} ${usd(v)}`).join(', ')
    return { text: `You have ${usd(tot)} in total (${src}): ${top}.${hid}`, chips: ['How much USDC on Base?', 'Price of SOL'] }
  }
  for (const [re, a, chips] of KB) if (re.test(t)) return { text: a, chips }
  for (const [re, a] of TALK) if (re.test(t)) return { text: pick(a), mood: 'happy' }
  return { text: 'I didn’t catch that. I’m a local assistant, not a chatbot, so I know your balances, prices, quotes, payments, swaps, limits and how ORI works. Try:', chips: DEFAULT_CHIPS }
}
export { DEFAULT_CHIPS }
