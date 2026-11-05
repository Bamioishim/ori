// Spending-limit decision. Pure and fail-closed: any invalid amount, cap or ledger value blocks the action.
// Enforcement scope (be honest): this runs in the ORI browser app only, right before ORI asks the connected
// wallet to sign. There is no server-side, NEAR contract or Chain Signatures check, and the ledger lives in
// localStorage, so it is a safety rail inside ORI, not a guarantee. It cannot govern an external wallet.
export type Caps = { perPay: number; daily: number }
const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0
export function decideLimit(caps: Caps, amt: number, spent: number): string | null {
  if (!valid(amt) || amt <= 0) return 'Amount is not valid, so ORI will not ask your wallet to sign.'
  if (!valid(caps.perPay) || !valid(caps.daily)) return 'Your spending limits look invalid. Re-set them in Policy before paying.'
  if (!valid(spent)) return 'Today’s spending record looks invalid, so ORI is blocking this until it is reset.'
  if (amt > caps.perPay) return `Over your per-payment cap of ${fmt(caps.perPay)}.`
  const left = caps.daily - spent
  if (amt > left) return `That would pass your daily cap of ${fmt(caps.daily)} (${fmt(Math.max(left, 0))} left today).`
  return null
}
